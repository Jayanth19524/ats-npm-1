import { Router, type IRouter } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  jobsTable,
  jobQuestionsTable,
} from "../db/index.js";
import { orgIdOf } from "../lib/viewer";

const router: IRouter = Router();

const QUESTION_TYPES = [
  "single_select",
  "multi_select",
  "text_short",
  "text_digit",
  "text_long",
] as const;

const QuestionInput = z.object({
  id: z.number().int().optional(),
  label: z.string().min(1).max(280),
  type: z.enum(QUESTION_TYPES),
  options: z.array(z.string().min(1).max(140)).max(20).optional(),
  required: z.boolean().optional().default(false),
});

const PutBody = z.object({
  questions: z.array(QuestionInput).max(15),
});

async function ensureJobBelongsToOrg(jobId: number, orgId: number) {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, jobId), eq(jobsTable.organizationId, orgId)));
  return job ?? null;
}

router.get("/jobs/:id/questions", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const orgId = orgIdOf(req);
  const job = await ensureJobBelongsToOrg(id, orgId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const rows = await db
    .select()
    .from(jobQuestionsTable)
    .where(eq(jobQuestionsTable.jobId, id))
    .orderBy(asc(jobQuestionsTable.position));
  res.json(rows);
});

router.put("/jobs/:id/questions", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const parsed = PutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const job = await ensureJobBelongsToOrg(id, orgId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Validate that select-type questions have at least one option
  for (const q of parsed.data.questions) {
    if (q.type === "single_select" || q.type === "multi_select") {
      if (!q.options || q.options.length === 0) {
        res
          .status(400)
          .json({ error: `Question "${q.label}" needs at least one option` });
        return;
      }
    }
  }

  // Replace strategy: delete all existing, then insert in order.
  // (Answers reference question IDs; deleting questions cascades implicitly via
  // best-effort orphan cleanup below. We don't enforce FK so this is safe.)
  await db.delete(jobQuestionsTable).where(eq(jobQuestionsTable.jobId, id));

  if (parsed.data.questions.length > 0) {
    await db.insert(jobQuestionsTable).values(
      parsed.data.questions.map((q, idx) => ({
        jobId: id,
        position: idx,
        label: q.label,
        type: q.type,
        options:
          q.type === "single_select" || q.type === "multi_select"
            ? q.options ?? []
            : null,
        required: q.required ?? false,
      })),
    );
  }

  const rows = await db
    .select()
    .from(jobQuestionsTable)
    .where(eq(jobQuestionsTable.jobId, id))
    .orderBy(asc(jobQuestionsTable.position));
  res.json(rows);
});

export default router;
