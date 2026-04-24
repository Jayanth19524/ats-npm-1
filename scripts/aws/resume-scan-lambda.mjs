import {
  GetObjectCommand,
  PutObjectTaggingCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const RESUME_SCAN_TAG_KEY = "scan-status";
const PENDING = "pending";
const CLEAN = "clean";
const INFECTED = "infected";

const s3 = new S3Client({});

async function updateTags(bucket, key, status) {
  await s3.send(
    new PutObjectTaggingCommand({
      Bucket: bucket,
      Key: key,
      Tagging: {
        TagSet: [{ Key: RESUME_SCAN_TAG_KEY, Value: status }],
      },
    }),
  );
}

async function runScanner(filePath) {
  const command = process.env.SCAN_COMMAND ?? "/opt/bin/clamscan";
  const args = (process.env.SCAN_ARGS ?? "--no-summary")
    .split(/\s+/)
    .filter(Boolean);

  return await new Promise((resolve, reject) => {
    const child = spawn(command, [...args, filePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(CLEAN);
        return;
      }
      if (code === 1) {
        resolve(INFECTED);
        return;
      }
      reject(new Error(stderr.trim() || `Scanner failed with exit code ${code}`));
    });
  });
}

export const handler = async (event) => {
  for (const record of event.Records ?? []) {
    const bucket = record.s3?.bucket?.name;
    const key = decodeURIComponent(record.s3?.object?.key?.replace(/\+/g, " ") ?? "");

    if (!bucket || !key.startsWith("resumes/")) {
      continue;
    }

    const tags = record.s3?.object?.tags ?? {};
    if (tags[RESUME_SCAN_TAG_KEY] && tags[RESUME_SCAN_TAG_KEY] !== PENDING) {
      continue;
    }

    const tempDir = path.join(tmpdir(), "pulse-resume-scan");
    const filePath = path.join(tempDir, path.basename(key));

    await mkdir(tempDir, { recursive: true });
    try {
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );

      if (!object.Body) {
        throw new Error(`No body returned for s3://${bucket}/${key}`);
      }

      await pipeline(object.Body, createWriteStream(filePath));
      const status = await runScanner(filePath);
      await updateTags(bucket, key, status);
      console.log(JSON.stringify({ bucket, key, status }));
    } catch (error) {
      console.error(JSON.stringify({ bucket, key, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    } finally {
      await unlink(filePath).catch(() => undefined);
    }
  }
};
