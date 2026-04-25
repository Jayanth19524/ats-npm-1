import { and, eq, isNull } from "drizzle-orm";
import { db, candidatesTable, jobsTable } from "./db/index.js";
import { extractSkills, extractTextFromPdf, extractYearsOfExperience } from "./lib/pdf.js";
import { calculateScore } from "./lib/scoring.js";
import { getResumeObject, isS3Configured } from "./lib/s3.js";
import { logger } from "./lib/logger.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function processUnscoredCandidates() {
  try {
    const unscored = await db
      .select({
        candidate: candidatesTable,
        job: jobsTable,
      })
      .from(candidatesTable)
      .innerJoin(jobsTable, eq(candidatesTable.jobId, jobsTable.id))
      .where(
        and(
          isNull(candidatesTable.score),
          eq(candidatesTable.resumeMimeType, "application/pdf")
        )
      )
      .limit(10);

    if (unscored.length === 0) return;

    logger.info(`Found ${unscored.length} unscored candidates. Processing...`);

    for (const { candidate, job } of unscored) {
      if (!candidate.resumeKey) {
        // Mark as processed with score 0 or similar if no resume?
        // For now, skip
        continue;
      }

      try {
        logger.info(`Scoring candidate ${candidate.id} (${candidate.name})`);

        let text = "";
        if (isS3Configured()) {
            const resumeObj = await getResumeObject(candidate.resumeKey);
            const buffer = await streamToBuffer(resumeObj.body);
            // Write to a temp file because pdf-parse needs a buffer, but my extractTextFromPdf expects a path
            // Actually I can just change extractTextFromPdf to accept buffer or path.
            // Let's use a temp file for now to keep extractTextFromPdf as is, or just use pdf(buffer) directly.
            const tempPath = path.join(os.tmpdir(), `resume-${candidate.id}.pdf`);
            await fs.writeFile(tempPath, buffer);
            text = await extractTextFromPdf(tempPath);
            await fs.unlink(tempPath).catch(() => undefined);
        } else {
            // Local storage
            const localPath = path.resolve(process.cwd(), "uploads", candidate.resumeKey);
            text = await extractTextFromPdf(localPath);
        }

        const candidateSkills = extractSkills(text, job.requiredSkills || []);
        const candidateYOE = extractYearsOfExperience(text);

        const score = calculateScore(
          candidateSkills,
          candidateYOE,
          job.requiredSkills,
          job.minExperience
        );

        await db
          .update(candidatesTable)
          .set({
            score,
            yearsOfExperience: candidateYOE,
            skills: candidateSkills,
          })
          .where(eq(candidatesTable.id, candidate.id));

        logger.info(`Candidate ${candidate.id} scored: ${score}`);
      } catch (err) {
        logger.error({ err, candidateId: candidate.id }, "Failed to score candidate");
        // Maybe update score to -1 to avoid infinite loop on failure?
        // Or just log it and move on.
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in processUnscoredCandidates");
  }
}

let interval: NodeJS.Timeout | null = null;

export function startWorker() {
  if (interval) return;
  logger.info("Starting resume scoring worker...");
  interval = setInterval(processUnscoredCandidates, 30000); // Every 30 seconds
  // Also run immediately
  void processUnscoredCandidates();
}

export function stopWorker() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
