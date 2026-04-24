import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, profilesTable, organizationsTable } from "../db/index.js";
import {
  GetMeResponse,
  SwitchRoleBody,
  SwitchRoleResponse,
  ListTeamResponse,
} from "../schemas/index.js";
import { getViewer, orgIdOf } from "../lib/viewer";
import { sendEmail, isEmailConfigured } from "../lib/email";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const viewer = await getViewer(req);
  res.json(GetMeResponse.parse(viewer));
});

router.patch("/me/role", async (req, res): Promise<void> => {
  const parsed = SwitchRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const viewer = await getViewer(req);
  const [updated] = await db
    .update(profilesTable)
    .set({ role: parsed.data.role })
    .where(eq(profilesTable.id, viewer.id))
    .returning();
  res.json(SwitchRoleResponse.parse(updated));
});

router.post("/team", async (req, res): Promise<void> => {
  const viewer = await getViewer(req);
  if (viewer.role !== "admin") {
    res.status(403).json({ error: "Only admins can add team members" });
    return;
  }
  const { name, email, role, password } = req.body ?? {};
  if (
    typeof name !== "string" || name.trim().length < 2 ||
    typeof email !== "string" || !email.includes("@") ||
    typeof role !== "string" ||
    !["admin", "recruiter", "hiring_manager"].includes(role)
  ) {
    res.status(400).json({ error: "Name, valid email and role (admin, recruiter, hiring_manager) are required" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, normalizedEmail));
  if (existing) {
    res.status(409).json({ error: "A member with this email already exists" });
    return;
  }
  const tempPassword =
    typeof password === "string" && password.length >= 6
      ? password
      : Math.random().toString(36).slice(2, 10) + "Aa1!";
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const [created] = await db
    .insert(profilesTable)
    .values({
      organizationId: orgIdOf(req),
      email: normalizedEmail,
      name: name.trim(),
      role,
      passwordHash,
    })
    .returning();
  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: `You've been added to ${viewer.name}'s recruiting workspace`,
    body:
      `Hi ${name.trim()},\n\n` +
      `${viewer.name} has added you to their recruiting workspace on Pulse.\n\n` +
      `Sign in here:\n` +
      `Email: ${normalizedEmail}\n` +
      `Temporary password: ${tempPassword}\n\n` +
      `Please change your password after signing in.`,
  });
  res.status(201).json({
    id: created.id,
    name: created.name,
    email: created.email,
    role: created.role,
    avatarUrl: created.avatarUrl ?? null,
    tempPassword: emailResult.delivered ? null : tempPassword,
    emailDelivered: emailResult.delivered,
    emailConfigured: isEmailConfigured(),
  });
});

router.get("/organization", async (req, res): Promise<void> => {
  const orgId = orgIdOf(req);
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json({
    id: org.id,
    slug: org.slug,
    name: org.name,
    description: org.description ?? "",
  });
});

router.patch("/organization", async (req, res): Promise<void> => {
  const viewer = await getViewer(req);
  if (viewer.role !== "admin") {
    res.status(403).json({ error: "Only admins can edit the workspace" });
    return;
  }
  const { name, description } = req.body ?? {};
  const updates: Record<string, string> = {};
  if (typeof name === "string" && name.trim().length >= 2) updates.name = name.trim();
  if (typeof description === "string") updates.description = description;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [org] = await db
    .update(organizationsTable)
    .set(updates)
    .where(eq(organizationsTable.id, orgIdOf(req)))
    .returning();
  res.json({
    id: org.id,
    slug: org.slug,
    name: org.name,
    description: org.description ?? "",
  });
});

router.get("/team", async (req, res): Promise<void> => {
  const orgId = orgIdOf(req);
  const rows = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.organizationId, orgId))
    .orderBy(profilesTable.name);
  res.json(ListTeamResponse.parse(rows));
});

export default router;
