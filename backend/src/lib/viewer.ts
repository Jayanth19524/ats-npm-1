import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, applicantsTable, type Profile, type Applicant } from "../db/index.js";
import { readSession } from "./session";

declare module "express-serve-static-core" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Request {
    orgId?: number;
    viewerProfile?: Profile;
  }
}

export async function getViewer(req: Request): Promise<Profile> {
  if (req.viewerProfile) return req.viewerProfile;
  const session = readSession(req);
  if (session?.kind === "staff") {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, session.id));
    if (profile) return profile;
  }
  const headerId = req.header("x-viewer-id");
  if (headerId) {
    const id = parseInt(headerId, 10);
    if (!Number.isNaN(id)) {
      const [profile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));
      if (profile) return profile;
    }
  }
  const [first] = await db.select().from(profilesTable).limit(1);
  if (!first) throw new Error("No profiles seeded");
  return first;
}

export async function getApplicant(req: Request): Promise<Applicant | null> {
  const session = readSession(req);
  if (session?.kind !== "candidate") return null;
  const [a] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, session.id));
  return a ?? null;
}

export async function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = readSession(req);
  let profile: Profile | undefined;
  if (session?.kind === "staff") {
    [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, session.id));
  } else if (req.header("x-viewer-id")) {
    const id = parseInt(req.header("x-viewer-id")!, 10);
    if (!Number.isNaN(id)) {
      [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, id));
    }
  }
  if (!profile) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  req.viewerProfile = profile;
  req.orgId = profile.organizationId;
  next();
}

export function requireCandidate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const session = readSession(req);
  if (session?.kind === "candidate") {
    next();
    return;
  }
  res.status(401).json({ error: "Sign in required" });
}

export function orgIdOf(req: Request): number {
  const id = req.orgId;
  if (typeof id !== "number") throw new Error("orgId not set on request");
  return id;
}
