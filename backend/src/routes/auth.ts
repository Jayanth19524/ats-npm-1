import { Router, type IRouter, type Request } from "express";
import { and, eq, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  profilesTable,
  applicantsTable,
  organizationsTable,
  passwordResetTokensTable,
} from "../db/index.js";
import { readSession, writeSession, clearSession } from "../lib/session";
import { createRateLimiter } from "../middlewares/rate-limit";
import { sendEmail } from "../lib/email";

const router: IRouter = Router();
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

type ResetKind = "staff" | "candidate";

function emailKey(req: Request): string {
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "unknown";
  return `${req.ip ?? "unknown"}:${email}`;
}

const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT ?? 20),
  keyGenerator: (req) => `login:${emailKey(req)}`,
  message: "Too many login attempts. Please wait and try again.",
});

const signupRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.SIGNUP_RATE_LIMIT ?? 10),
  keyGenerator: (req) => `signup:${req.ip ?? "unknown"}`,
  message: "Too many signup attempts. Please wait and try again.",
});

const forgotPasswordRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PASSWORD_RESET_RATE_LIMIT ?? 10),
  keyGenerator: (req) => `forgot:${emailKey(req)}`,
  message: "Too many password reset attempts. Please wait and try again.",
});

const resetPasswordRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PASSWORD_RESET_RATE_LIMIT ?? 10),
  keyGenerator: (req) => `reset:${req.ip ?? "unknown"}`,
  message: "Too many password reset attempts. Please wait and try again.",
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "agency";
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [existing] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, candidate));
    if (!existing) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

function normalizeEmail(value: unknown): string | null {
  return typeof value === "string" && value.includes("@")
    ? value.toLowerCase().trim()
    : null;
}

function appBaseUrl(req: Request): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const proto = req.header("x-forwarded-proto") ?? req.protocol;
  const host = req.header("x-forwarded-host") ?? req.get("host");
  if (!host) throw new Error("Could not determine application URL");
  return `${proto}://${host}`;
}

function resetPath(kind: ResetKind, token: string): string {
  const base = kind === "staff" ? "/reset-password" : "/careers/reset-password";
  return `${base}?token=${encodeURIComponent(token)}`;
}

async function createPasswordResetToken(kind: ResetKind, userId: number): Promise<string> {
  const crypto = await import("node:crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db
    .delete(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.kind, kind),
        eq(passwordResetTokensTable.userId, userId),
      ),
    );

  await db.insert(passwordResetTokensTable).values({
    kind,
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

async function purgeExpiredResetTokens(): Promise<void> {
  await db
    .delete(passwordResetTokensTable)
    .where(lt(passwordResetTokensTable.expiresAt, new Date()));
}

async function sendPasswordResetEmail(
  req: Request,
  kind: ResetKind,
  email: string,
  name: string,
  userId: number,
): Promise<string | null> {
  const token = await createPasswordResetToken(kind, userId);
  const url = `${appBaseUrl(req)}${resetPath(kind, token)}`;
  const result = await sendEmail({
    to: email,
    subject: "Reset your Pulse password",
    body: [
      `Hi ${name || "there"},`,
      "",
      "We received a request to reset your password.",
      `Use this link to choose a new password: ${url}`,
      "",
      "This link expires in 1 hour. If you did not request a reset, you can ignore this email.",
    ].join("\n"),
  });

  if (!result.delivered && process.env.NODE_ENV !== "production") {
    return url;
  }

  return null;
}

router.get("/auth/me", async (req, res): Promise<void> => {
  const s = readSession(req);
  if (!s) {
    res.json({ kind: null });
    return;
  }
  if (s.kind === "staff") {
    const [p] = await db.select().from(profilesTable).where(eq(profilesTable.id, s.id));
    if (!p) {
      res.json({ kind: null });
      return;
    }
    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, p.organizationId));
    res.json({
      kind: "staff",
      id: p.id,
      email: p.email,
      name: p.name,
      role: p.role,
      organizationId: p.organizationId,
      organizationName: org?.name ?? null,
      organizationSlug: org?.slug ?? null,
    });
    return;
  }
  const [a] = await db.select().from(applicantsTable).where(eq(applicantsTable.id, s.id));
  if (!a) {
    res.json({ kind: null });
    return;
  }
  res.json({
    kind: "candidate",
    id: a.id,
    email: a.email,
    name: a.name,
    phone: a.phone,
    location: a.location,
  });
});

router.post("/auth/staff/forgot-password", forgotPasswordRateLimit, async (req, res): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  await purgeExpiredResetTokens();
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, email));

  let previewUrl: string | null = null;
  if (profile?.passwordHash) {
    previewUrl = await sendPasswordResetEmail(req, "staff", profile.email, profile.name, profile.id);
  }

  res.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
    ...(previewUrl ? { previewUrl } : {}),
  });
});

router.post("/auth/staff/login", loginRateLimit, async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const [p] = await db.select().from(profilesTable).where(eq(profilesTable.email, email.toLowerCase()));
  if (!p || !p.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const ok = await bcrypt.compare(password, p.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  writeSession(res, { kind: "staff", id: p.id });
  res.json({ kind: "staff", id: p.id, email: p.email, name: p.name, role: p.role });
});

router.post("/auth/staff/reset-password", resetPasswordRateLimit, async (req, res): Promise<void> => {
  const { token, password } = req.body ?? {};
  if (typeof token !== "string" || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "A valid token and a 6+ character password are required" });
    return;
  }

  await purgeExpiredResetTokens();
  const crypto = await import("node:crypto");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const [reset] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.kind, "staff"),
        eq(passwordResetTokensTable.tokenHash, tokenHash),
      ),
    );

  if (!reset || reset.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "This reset link is invalid or has expired" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [profile] = await db
    .update(profilesTable)
    .set({ passwordHash })
    .where(eq(profilesTable.id, reset.userId))
    .returning();

  if (!profile) {
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, reset.id));
    res.status(400).json({ error: "This reset link is invalid or has expired" });
    return;
  }

  await db
    .delete(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.kind, "staff"),
        eq(passwordResetTokensTable.userId, reset.userId),
      ),
    );

  res.json({ ok: true });
});

router.post("/auth/agency/signup", signupRateLimit, async (req, res): Promise<void> => {
  const { agencyName, name, email, password } = req.body ?? {};
  if (
    typeof agencyName !== "string" || agencyName.trim().length < 2 ||
    typeof name !== "string" || name.trim().length < 2 ||
    typeof email !== "string" || !email.includes("@") ||
    typeof password !== "string" || password.length < 6
  ) {
    res.status(400).json({ error: "Agency name, your name, valid email, and a 6+ character password are required" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const [existingProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, normalizedEmail));
  if (existingProfile) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }
  const slug = await uniqueSlug(slugify(agencyName));
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: agencyName.trim(), slug })
    .returning();
  const passwordHash = await bcrypt.hash(password, 10);
  const [profile] = await db
    .insert(profilesTable)
    .values({
      organizationId: org.id,
      email: normalizedEmail,
      name: name.trim(),
      role: "admin",
      passwordHash,
    })
    .returning();
  writeSession(res, { kind: "staff", id: profile.id });
  res.status(201).json({
    kind: "staff",
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    organizationId: org.id,
    organizationName: org.name,
    organizationSlug: org.slug,
  });
});

router.post("/auth/candidate/signup", signupRateLimit, async (req, res): Promise<void> => {
  const { email, password, name, phone, location } = req.body ?? {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof name !== "string" ||
    password.length < 6 ||
    name.trim().length < 2
  ) {
    res.status(400).json({ error: "Name, email, and a 6+ character password are required" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const [existing] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.email, normalizedEmail));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [a] = await db
    .insert(applicantsTable)
    .values({
      email: normalizedEmail,
      name: name.trim(),
      passwordHash,
      phone: typeof phone === "string" && phone ? phone : null,
      location: typeof location === "string" && location ? location : null,
    })
    .returning();
  writeSession(res, { kind: "candidate", id: a.id });
  res.status(201).json({
    kind: "candidate",
    id: a.id,
    email: a.email,
    name: a.name,
    phone: a.phone,
    location: a.location,
  });
});

router.post("/auth/candidate/login", loginRateLimit, async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const [a] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.email, email.toLowerCase().trim()));
  if (!a) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const ok = await bcrypt.compare(password, a.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  writeSession(res, { kind: "candidate", id: a.id });
  res.json({
    kind: "candidate",
    id: a.id,
    email: a.email,
    name: a.name,
    phone: a.phone,
    location: a.location,
  });
});

router.post("/auth/candidate/forgot-password", forgotPasswordRateLimit, async (req, res): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  await purgeExpiredResetTokens();
  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.email, email));

  let previewUrl: string | null = null;
  if (applicant?.passwordHash) {
    previewUrl = await sendPasswordResetEmail(
      req,
      "candidate",
      applicant.email,
      applicant.name,
      applicant.id,
    );
  }

  res.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
    ...(previewUrl ? { previewUrl } : {}),
  });
});

router.post("/auth/candidate/reset-password", resetPasswordRateLimit, async (req, res): Promise<void> => {
  const { token, password } = req.body ?? {};
  if (typeof token !== "string" || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "A valid token and a 6+ character password are required" });
    return;
  }

  await purgeExpiredResetTokens();
  const crypto = await import("node:crypto");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const [reset] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.kind, "candidate"),
        eq(passwordResetTokensTable.tokenHash, tokenHash),
      ),
    );

  if (!reset || reset.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "This reset link is invalid or has expired" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [applicant] = await db
    .update(applicantsTable)
    .set({ passwordHash })
    .where(eq(applicantsTable.id, reset.userId))
    .returning();

  if (!applicant) {
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, reset.id));
    res.status(400).json({ error: "This reset link is invalid or has expired" });
    return;
  }

  await db
    .delete(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.kind, "candidate"),
        eq(passwordResetTokensTable.userId, reset.userId),
      ),
    );

  res.json({ ok: true });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  clearSession(res);
  res.json({ ok: true });
});

export default router;
