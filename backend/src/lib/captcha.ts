import crypto from "node:crypto";

const SECRET =
  process.env.CAPTCHA_SECRET ||
  process.env.SESSION_SECRET ||
  "dev-only-captcha-secret";

const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CaptchaPayload {
  a: number; // expected answer
  e: number; // expiry timestamp (ms)
  n: string; // nonce
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
}

function encode(payload: CaptchaPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

function decode(token: string): CaptchaPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export interface Challenge {
  token: string;
  question: string;
}

export function issueChallenge(): Challenge {
  // Simple addition that's accessible. Numbers 1..9.
  const x = 1 + Math.floor(Math.random() * 9);
  const y = 1 + Math.floor(Math.random() * 9);
  const payload: CaptchaPayload = {
    a: x + y,
    e: Date.now() + TTL_MS,
    n: crypto.randomBytes(8).toString("base64url"),
  };
  return {
    token: encode(payload),
    question: `What is ${x} + ${y}?`,
  };
}

export function verifyChallenge(
  token: unknown,
  answer: unknown,
): { ok: true } | { ok: false; reason: string } {
  if (typeof token !== "string" || !token) {
    return { ok: false, reason: "Captcha token missing" };
  }
  const ans =
    typeof answer === "number"
      ? answer
      : typeof answer === "string"
        ? Number(answer.trim())
        : NaN;
  if (!Number.isFinite(ans)) {
    return { ok: false, reason: "Captcha answer required" };
  }
  const payload = decode(token);
  if (!payload) return { ok: false, reason: "Invalid captcha token" };
  if (payload.e < Date.now())
    return { ok: false, reason: "Captcha expired, please refresh" };
  if (payload.a !== ans)
    return { ok: false, reason: "Captcha answer is incorrect" };
  return { ok: true };
}
