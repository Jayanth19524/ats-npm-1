/**
 * Email helper using Nodemailer.
 *
 * Configure via environment variables:
 *   SMTP_HOST   – e.g. smtp.gmail.com | smtp.sendgrid.net
 *   SMTP_PORT   – 465 (SSL) or 587 (STARTTLS) or 25
 *   SMTP_USER   – SMTP username / API key username
 *   SMTP_PASS   – SMTP password / API key
 *   SMTP_FROM   – "From" address, e.g. "Pulse ATS <no-reply@example.com>"
 *
 * If none of the SMTP_* vars are set the module works in "no-op" mode:
 * sendEmail() returns { delivered: false, reason: "smtp_not_configured" }
 * and logs a warning instead of throwing.
 *
 * Common provider quick-start:
 *   Gmail (App Password):  SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=you@gmail.com  SMTP_PASS=<app-password>
 *   SendGrid:              SMTP_HOST=smtp.sendgrid.net  SMTP_PORT=587  SMTP_USER=apikey  SMTP_PASS=<SG.xxxx>
 *   Resend:                SMTP_HOST=smtp.resend.com  SMTP_PORT=587  SMTP_USER=resend  SMTP_PASS=<re_xxxx>
 *   Mailgun:               SMTP_HOST=smtp.mailgun.org  SMTP_PORT=587  SMTP_USER=postmaster@mg.example.com  SMTP_PASS=<key>
 */

import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger.js";

// ── Transporter cache ─────────────────────────────────────────────────────────

let _transporter: Transporter | null = null;
let _transporterKey = "";

function buildTransporterKey(): string {
  return [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_USER,
  ].join(":");
}

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  const port = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !port || !user || !pass) return null;

  const key = buildTransporterKey();
  if (_transporter && _transporterKey === key) return _transporter;

  _transporterKey = key;
  const portNum = Number(port);
  _transporter = nodemailer.createTransport({
    host,
    port: portNum,
    // port 465 → implicit TLS; 587/25 → STARTTLS
    secure: portNum === 465,
    auth: { user, pass },
    // Increase timeouts for slow SMTP relays
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return _transporter;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  subject: string;
  /** Plain-text body. Newlines and paragraphs are rendered to HTML automatically. */
  body: string;
}

export interface SendEmailResult {
  delivered: boolean;
  reason?: string;
  messageId?: string;
}

// ── Public helpers ────────────────────────────────────────────────────────────

export function isEmailConfigured(): boolean {
  return getTransporter() !== null;
}

/**
 * Verify SMTP credentials by opening a connection (useful for health checks).
 * Returns true on success, false + logs error on failure.
 */
export async function verifyEmailConfig(): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    return true;
  } catch (err) {
    logger.error({ err }, "SMTP connection verification failed");
    return false;
  }
}

/**
 * Convert a plain-text body into a clean HTML email.
 * Double newlines become paragraph breaks; single newlines become <br>.
 */
function bodyToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1em 0">${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Email</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222;background:#f5f5f5;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
          <tr>
            <td style="background:#1a1a2e;padding:20px 32px">
              <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.5px">Pulse ATS</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              ${paragraphs}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #eee;font-size:12px;color:#888">
              This email was sent by Pulse ATS. Please do not reply directly to this message.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const transporter = getTransporter();
  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "Pulse ATS <no-reply@pulse.local>";

  if (!transporter) {
    logger.warn(
      { to: input.to, subject: input.subject },
      "Email skipped – SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS not set",
    );
    return { delivered: false, reason: "smtp_not_configured" };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
      html: bodyToHtml(input.body),
    });
    logger.info(
      { to: input.to, subject: input.subject, messageId: info.messageId },
      "Email delivered",
    );
    return { delivered: true, messageId: info.messageId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error({ err, to: input.to }, "Email send failed");

    // Reset cached transporter so the next attempt re-connects
    _transporter = null;
    _transporterKey = "";

    return { delivered: false, reason };
  }
}

// ── Template rendering ────────────────────────────────────────────────────────

/**
 * Replace {{variable_name}} placeholders in a template string.
 * Missing variables are replaced with an empty string.
 */
export function renderTemplate(
  text: string,
  vars: Record<string, string | null | undefined>,
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const v = vars[name];
    return v == null ? "" : String(v);
  });
}
