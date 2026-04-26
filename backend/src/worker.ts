import { and, eq, isNull, isNotNull } from "drizzle-orm";
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

async function scoreCandidate(candidate: typeof candidatesTable.$inferSelect, job: typeof jobsTable.$inferSelect): Promise<void> {
  if (!candidate.resumeKey) return;

  let text = "";
  if (isS3Configured()) {
    const resumeObj = await getResumeObject(candidate.resumeKey);
    const buffer = await streamToBuffer(resumeObj.body);
    const tempPath = path.join(os.tmpdir(), `resume-${candidate.id}.pdf`);
    await fs.writeFile(tempPath, buffer);
    text = await extractTextFromPdf(tempPath);
    await fs.unlink(tempPath).catch(() => undefined);
  } else {
    const localPath = path.resolve(process.cwd(), "uploads", candidate.resumeKey);
    text = await extractTextFromPdf(localPath);
  }

  if (!text || text.trim().length === 0) {
    logger.warn(`Candidate ${candidate.id}: could not extract text from PDF, skipping`);
    return;
  }

  const candidateSkills = extractSkills(text, job.requiredSkills || []);
  const candidateYOE = extractYearsOfExperience(text);

  const score = calculateScore(
    candidateSkills,
    candidateYOE,
    job.requiredSkills,
    job.minExperience,
    text,             // resume text for description matching
    job.description,  // job description
  );

  await db
    .update(candidatesTable)
    .set({ score, yearsOfExperience: candidateYOE, skills: candidateSkills })
    .where(eq(candidatesTable.id, candidate.id));

  logger.info(`Candidate ${candidate.id} (${candidate.name}): score=${score}, yoe=${candidateYOE}, skills=[${candidateSkills.join(", ")}]`);
}

// ─── Regular worker: scores only new unscored candidates ─────────────────────

export async function processUnscoredCandidates() {
  try {
    const unscored = await db
      .select({ candidate: candidatesTable, job: jobsTable })
      .from(candidatesTable)
      .innerJoin(jobsTable, eq(candidatesTable.jobId, jobsTable.id))
      .where(
        and(
          isNull(candidatesTable.score),
          eq(candidatesTable.resumeMimeType, "application/pdf"),
          isNotNull(candidatesTable.resumeKey),
        ),
      )
      .limit(10);

    if (unscored.length === 0) return;

    logger.info(`Found ${unscored.length} unscored candidates. Processing...`);

    for (const { candidate, job } of unscored) {
      try {
        await scoreCandidate(candidate, job);
      } catch (err) {
        logger.error({ err, candidateId: candidate.id }, "Failed to score candidate");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in processUnscoredCandidates");
  }
}

// ─── One-time rescore: rescores ALL candidates with PDF resumes ───────────────

export async function rescoreAllCandidates() {
  logger.info("=== Starting one-time rescore of ALL candidates ===");

  const all = await db
    .select({ candidate: candidatesTable, job: jobsTable })
    .from(candidatesTable)
    .innerJoin(jobsTable, eq(candidatesTable.jobId, jobsTable.id))
    .where(
      and(
        eq(candidatesTable.resumeMimeType, "application/pdf"),
        isNotNull(candidatesTable.resumeKey),
      ),
    );

  if (all.length === 0) {
    logger.info("No candidates with PDF resumes found.");
    return;
  }

  logger.info(`Rescoring ${all.length} candidates...`);

  let success = 0;
  let failed = 0;

  for (const { candidate, job } of all) {
    try {
      await scoreCandidate(candidate, job);
      success++;
    } catch (err) {
      logger.error({ err, candidateId: candidate.id }, `Failed to rescore candidate ${candidate.id}`);
      failed++;
    }
  }

  logger.info(`=== Rescore complete: ${success} succeeded, ${failed} failed ===`);
}

// ─── Worker lifecycle ─────────────────────────────────────────────────────────

let interval: NodeJS.Timeout | null = null;

export function startWorker() {
  if (interval) return;
  logger.info("Starting resume scoring worker...");
  interval = setInterval(processUnscoredCandidates, 30000);
  void processUnscoredCandidates();
}

export function stopWorker() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}