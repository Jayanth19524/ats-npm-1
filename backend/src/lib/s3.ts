/**
 * S3 resume upload helper.
 *
 * Uses the AWS SDK v3 (@aws-sdk/client-s3).
 * Falls back to local disk storage when S3 env vars are absent so that local
 * development keeps working without any AWS credentials.
 *
 * Required env vars (all optional – omit to use local disk):
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION          (default: us-east-1)
 *   S3_BUCKET           bucket name
 *
 * LocalStack vars (for local testing):
 *   S3_ENDPOINT         e.g. http://localhost:4566
 *                       When set, forcePathStyle is enabled automatically.
 */

import {
  GetObjectCommand,
  GetObjectTaggingCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { logger } from "./logger.js";
import { randomBytes } from "node:crypto";
import path from "node:path";

export interface S3UploadResult {
  url: string;
  key: string;
  backend: "s3" | "local";
}

export interface PresignedResumeUploadResult extends S3UploadResult {
  uploadUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export interface ResumeObject {
  body: NodeJS.ReadableStream;
  contentType?: string;
  contentLength?: number;
}

export const RESUME_SCAN_TAG_KEY = "scan-status";
export const RESUME_SCAN_PENDING = "pending";
export const RESUME_SCAN_CLEAN = "clean";
export const RESUME_SCAN_INFECTED = "infected";

export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET
  );
}

function assertResumeKey(key: string): void {
  if (
    !key.startsWith("resumes/") ||
    key.includes("..") ||
    key.includes("\\") ||
    key.endsWith("/")
  ) {
    throw new Error("Invalid resume key");
  }
}

export function resumeKeyToToken(key: string): string {
  assertResumeKey(key);
  return Buffer.from(key, "utf8").toString("base64url");
}

export function resumeTokenToKey(token: string): string {
  const key = Buffer.from(token, "base64url").toString("utf8");
  assertResumeKey(key);
  return key;
}

export function resumeDownloadUrl(key: string): string {
  return `/api/uploads/resume/${resumeKeyToToken(key)}`;
}

function contentTypeForExt(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "rtf":
      return "application/rtf";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function localResumePath(key: string): string {
  assertResumeKey(key);
  return path.resolve(process.cwd(), "uploads", key);
}

function createResumeKey(originalFilename: string): string {
  const ext = originalFilename.split(".").pop()?.slice(0, 10) || "bin";
  return `resumes/${Date.now()}-${randomBytes(12).toString("hex")}.${ext}`;
}

function createS3Client() {
  const region = "us-east-1";
  const endpoint = process.env.S3_ENDPOINT;

  return new S3Client({
    region,
    ...(endpoint
      ? {
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }
      : {}),
  });
}

function scanTagHeaderValue(status: string): string {
  return `${RESUME_SCAN_TAG_KEY}=${encodeURIComponent(status)}`;
}

export async function getResumeScanStatus(key: string): Promise<string | null> {
  assertResumeKey(key);

  if (!isS3Configured()) {
    return RESUME_SCAN_CLEAN;
  }

  const bucket = process.env.S3_BUCKET!;
  const client = createS3Client();
  const result = await client.send(
    new GetObjectTaggingCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  const tag = result.TagSet?.find((entry) => entry.Key === RESUME_SCAN_TAG_KEY)?.Value;
  return tag ?? null;
}

export async function createPresignedResumeUpload(
  originalFilename: string,
  mimeType: string,
): Promise<PresignedResumeUploadResult> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const bucket = process.env.S3_BUCKET!;
  const key = createResumeKey(originalFilename);
  const url = resumeDownloadUrl(key);
  const expiresInSeconds = 300;
  const client = createS3Client();

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
      Tagging: scanTagHeaderValue(RESUME_SCAN_PENDING),
    }),
    { expiresIn: expiresInSeconds },
  );

  return {
    uploadUrl,
    url,
    key,
    backend: "s3",
    headers: {

    },
    expiresInSeconds,
  };
}

export async function uploadResume(
  filePath: string,
  originalFilename: string,
  mimeType: string,
): Promise<S3UploadResult> {
  const fs = await import("node:fs");
  const key = createResumeKey(originalFilename);
  const url = resumeDownloadUrl(key);

  if (!isS3Configured()) {
    const path = await import("node:path");
    const dir = path.resolve(process.cwd(), "uploads", "resumes");
    fs.mkdirSync(dir, { recursive: true });
    const filename = key.replace("resumes/", "");
    await fs.promises.copyFile(filePath, path.join(dir, filename));
    logger.info({ key }, "Resume saved to local disk (S3 not configured)");
    return { url, key, backend: "local" };
  }

  const bucket = process.env.S3_BUCKET!;
  const endpoint = process.env.S3_ENDPOINT; // set this for LocalStack
  const isLocalStack = !!endpoint;
  const client = createS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: mimeType,
      Tagging: scanTagHeaderValue(RESUME_SCAN_PENDING),
    }),
  );

  logger.info({ key, bucket, localstack: isLocalStack }, "Resume uploaded to S3");
  return { url, key, backend: "s3" };
}

export async function getResumeObject(key: string): Promise<ResumeObject> {
  assertResumeKey(key);

  if (!isS3Configured()) {
    const fs = await import("node:fs");
    const filePath = localResumePath(key);
    const stat = await fs.promises.stat(filePath);
    return {
      body: fs.createReadStream(filePath),
      contentType: contentTypeForExt(key),
      contentLength: stat.size,
    };
  }

  const scanStatus = await getResumeScanStatus(key);
  if (scanStatus === RESUME_SCAN_PENDING) {
    throw new Error("Resume is still pending malware scan");
  }
  if (scanStatus === RESUME_SCAN_INFECTED) {
    throw new Error("Resume failed malware scan");
  }

  const bucket = process.env.S3_BUCKET!;
  const client = createS3Client();

  const result = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!result.Body || typeof (result.Body as NodeJS.ReadableStream).pipe !== "function") {
    throw new Error("Resume object is not streamable");
  }

  return {
    body: result.Body as NodeJS.ReadableStream,
    contentType: result.ContentType ?? contentTypeForExt(key),
    contentLength: result.ContentLength,
  };
}
