import type { Request, Response } from "express";

export type SessionKind = "staff" | "candidate";

export interface SessionPayload {
  kind: SessionKind;
  id: number;
}

const COOKIE_NAME = "pulse_session";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export function readSession(req: Request): SessionPayload | null {
  const raw = req.signedCookies?.[COOKIE_NAME];
  if (!raw || typeof raw !== "string") return null;
  const [kind, idStr] = raw.split(":");
  const id = Number(idStr);
  if ((kind !== "staff" && kind !== "candidate") || !Number.isInteger(id)) {
    return null;
  }
  return { kind, id };
}

export function writeSession(res: Response, payload: SessionPayload): void {
  res.cookie(COOKIE_NAME, `${payload.kind}:${payload.id}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    signed: true,
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}
