import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConcurrencyLimiter, createRateLimiter } from "../middlewares/rate-limit.js";
import {
  createPresignedResumeUpload,
  getResumeObject,
  isS3Configured,
  resumeTokenToKey,
  uploadResume,
} from "../lib/s3.js";

// ── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf",
]);
const EXTENSIONS_BY_MIME = new Map<string, string[]>([
  ["application/pdf", ["pdf"]],
  ["application/msword", ["doc"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ["docx"]],
  ["text/plain", ["txt"]],
  ["application/rtf", ["rtf"]],
]);

const TMP_UPLOAD_DIR = path.join(os.tmpdir(), "pulse-resume-uploads");
const MAX_UPLOAD_SIZE = 8 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = Number(process.env.UPLOAD_CONCURRENCY_LIMIT ?? 20);

fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });

const uploadRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT ?? 30),
  message: "Too many uploads. Please wait a bit and try again.",
});

const uploadConcurrencyLimit = createConcurrencyLimiter({
  max: Number.isFinite(MAX_CONCURRENT_UPLOADS) && MAX_CONCURRENT_UPLOADS > 0
    ? MAX_CONCURRENT_UPLOADS
    : 20,
  message: "Too many uploads are running. Please try again shortly.",
});

const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_UPLOAD_DIR,
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type. Accepted: PDF, DOC, DOCX, TXT, RTF"));
  },
});

const router: IRouter = Router();

async function deleteTempFile(filePath: string | undefined): Promise<void> {
  if (!filePath) return;
  await fs.promises.unlink(filePath).catch(() => undefined);
}

async function readHead(filePath: string): Promise<Buffer> {
  const file = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(512);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function looksLikeText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  const sample = buffer.toString("utf8");
  return !sample.includes("\uFFFD");
}

function validateResumeMetadata(filename: string, mimeType: string, size: number): void {
  if (!filename || filename.length > 255) {
    throw new Error("Invalid file name.");
  }

  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error("Unsupported file type. Accepted: PDF, DOC, DOCX, TXT, RTF");
  }

  const extension = filename.toLowerCase().split(".").pop() ?? "";
  const allowedExtensions = EXTENSIONS_BY_MIME.get(mimeType) ?? [];
  if (!allowedExtensions.includes(extension)) {
    throw new Error("The file extension does not match the selected file type.");
  }

  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Invalid file size.");
  }

  if (size > MAX_UPLOAD_SIZE) {
    throw new Error("File is larger than 8 MB");
  }
}

async function validateResumeContent(filePath: string, mimeType: string): Promise<void> {
  const head = await readHead(filePath);
  const asText = head.toString("utf8").trimStart();
  const isZip = startsWithBytes(head, [0x50, 0x4b]);
  const isOleDoc = startsWithBytes(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

  const ok =
    (mimeType === "application/pdf" && head.toString("ascii", 0, 5) === "%PDF-") ||
    (mimeType === "application/msword" && isOleDoc) ||
    (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && isZip) ||
    (mimeType === "application/rtf" && asText.startsWith("{\\rtf")) ||
    (mimeType === "text/plain" && looksLikeText(head));

  if (!ok) {
    throw new Error("The uploaded file content does not match its file type.");
  }
}

async function scanResumeFile(filePath: string): Promise<void> {
  const command = process.env.RESUME_SCAN_COMMAND;
  if (!command) return;

  const { execFile } = await import("node:child_process");
  const args = (process.env.RESUME_SCAN_ARGS ?? "--no-summary")
    .split(/\s+/)
    .filter(Boolean);

  await new Promise<void>((resolve, reject) => {
    execFile(command, [...args, filePath], { timeout: 30_000 }, (err, _stdout, stderr) => {
      if (!err) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || "Resume failed malware scan"));
    });
  });
}

function handleMulterUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File is larger than 8 MB" });
      return;
    }

    const message = err instanceof Error ? err.message : "Upload failed";
    res.status(400).json({ error: message });
  });
}

router.post("/uploads/resume/presign", uploadRateLimit, async (req, res): Promise<void> => {
  try {
    const filename = typeof req.body?.filename === "string" ? req.body.filename.trim() : "";
    const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType.trim() : "";
    const size = Number(req.body?.size);

    validateResumeMetadata(filename, mimeType, size);

    if (!isS3Configured()) {
      res.json({ strategy: "local" as const });
      return;
    }

    const upload = await createPresignedResumeUpload(filename, mimeType);
    res.json({
      strategy: "s3" as const,
      ...upload,
      filename,
      size,
      mimeType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not prepare upload";
    res.status(message.includes("file") || message.includes("extension") ? 400 : 500).json({
      error: message,
    });
  }
});

router.post(
  "/uploads/resume",
  uploadRateLimit,
  uploadConcurrencyLimit,
  handleMulterUpload,
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    try {
      await validateResumeContent(req.file.path, req.file.mimetype);
      await scanResumeFile(req.file.path);
      const result = await uploadResume(
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
      );
      res.status(201).json({
        url: result.url,
        key: result.key,
        backend: result.backend,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      res
        .status(message.includes("file content") || message.includes("malware scan") ? 400 : 500)
        .json({ error: message });
    } finally {
      await deleteTempFile(req.file.path);
    }
  },
);

router.get("/uploads/resume/:token", async (req, res): Promise<void> => {
  try {
    const key = resumeTokenToKey(req.params.token);
    const object = await getResumeObject(key);
    const filename = path.basename(key);

    res.setHeader("Content-Type", object.contentType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${filename.replace(/"/g, "")}"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    if (object.contentLength !== undefined) {
      res.setHeader("Content-Length", String(object.contentLength));
    }

    object.body.on("error", () => {
      if (!res.headersSent) res.status(500).json({ error: "Could not read resume" });
      else res.destroy();
    });
    object.body.pipe(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resume not found";
    if (message === "Invalid resume key") {
      res.status(400).json({ error: message });
      return;
    }
    if (message === "Resume is still pending malware scan") {
      res.status(409).json({ error: message });
      return;
    }
    if (message === "Resume failed malware scan") {
      res.status(403).json({ error: message });
      return;
    }
    res.status(404).json({ error: message });
  }
});

export default router;
