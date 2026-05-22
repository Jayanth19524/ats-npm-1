import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  jobsTable,
  stagesTable,
  candidatesTable,
  candidateStagesTable,
  candidateNotesTable,
  activityTable,
  organizationsTable,
  jobQuestionsTable,
  candidateAnswersTable,
} from "../db/index.js";
import { getApplicant, requireCandidate } from "../lib/viewer";
import { issueChallenge, verifyChallenge } from "../lib/captcha";

const router: IRouter = Router();

router.get("/public/captcha", (_req, res): void => {
  res.json(issueChallenge());
});

// List all agencies (used by /careers landing)
router.get("/public/agencies", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: organizationsTable.id,
      slug: organizationsTable.slug,
      name: organizationsTable.name,
    })
    .from(organizationsTable)
    .orderBy(organizationsTable.name);
  res.json(rows);
});

router.get("/public/agencies/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug || "");
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, slug));
  if (!org) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.json({ id: org.id, slug: org.slug, name: org.name, description: org.description ?? "" });
});

router.get("/public/agencies/:slug/jobs", async (req, res): Promise<void> => {
  const slug = String(req.params.slug || "");
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, slug));
  if (!org) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  const rows = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.status, "open"), eq(jobsTable.organizationId, org.id)))
    .orderBy(desc(jobsTable.createdAt));
  res.json(rows);
});

router.get("/public/agencies/:slug/jobs/:id", async (req, res): Promise<void> => {
  const slug = String(req.params.slug || "");
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, slug));
  if (!org) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.id, id),
        eq(jobsTable.status, "open"),
        eq(jobsTable.organizationId, org.id),
      ),
    );
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ ...job, organizationName: org.name, organizationSlug: org.slug });
});

// Public application form definition for a job (used by careers page)
router.get(
  "/public/agencies/:slug/jobs/:id/questions",
  async (req, res): Promise<void> => {
    const slug = String(req.params.slug || "");
    const jobId = Number(req.params.id);
    if (!Number.isInteger(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }
    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, slug));
    if (!org) {
      res.status(404).json({ error: "Agency not found" });
      return;
    }
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.id, jobId),
          eq(jobsTable.organizationId, org.id),
          eq(jobsTable.status, "open"),
        ),
      );
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const rows = await db
      .select()
      .from(jobQuestionsTable)
      .where(eq(jobQuestionsTable.jobId, jobId))
      .orderBy(asc(jobQuestionsTable.position));
    res.json(rows);
  },
);

const ApplyBody = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  currentTitle: z.string().trim().max(160).optional().or(z.literal("")),
  coverLetter: z.string().max(10_000).optional().or(z.literal("")),
  resumeUrl: z.string().max(2048).optional().or(z.literal("")),
  resumeKey: z.string().max(512).optional().or(z.literal("")),
  resumeFilename: z.string().max(256).optional().or(z.literal("")),
  resumeMimeType: z.string().max(128).optional().or(z.literal("")),
  resumeSize: z.number().int().nonnegative().optional(),
  captchaToken: z.string().min(1),
  captchaAnswer: z.union([z.string(), z.number()]),
  answers: z
    .array(
      z.object({
        questionId: z.number().int(),
        value: z.union([z.string(), z.array(z.string())]),
      }),
    )
    .max(15)
    .optional()
    .default([]),
});

router.post(
  "/public/agencies/:slug/jobs/:id/apply",
  async (req, res): Promise<void> => {
    const slug = String(req.params.slug || "");
    const jobId = Number(req.params.id);
    if (!Number.isInteger(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }
    const parsed = ApplyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const data = parsed.data;

    const captcha = verifyChallenge(data.captchaToken, data.captchaAnswer);
    if (!captcha.ok) {
      res.status(400).json({ error: captcha.reason });
      return;
    }

    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, slug));
    if (!org) {
      res.status(404).json({ error: "Agency not found" });
      return;
    }
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.id, jobId),
          eq(jobsTable.status, "open"),
          eq(jobsTable.organizationId, org.id),
        ),
      );
    if (!job) {
      res.status(404).json({ error: "Job not found or no longer open" });
      return;
    }

    // Block duplicate applications by email per job
    const [duplicate] = await db
      .select({ id: candidatesTable.id })
      .from(candidatesTable)
      .where(
        and(
          eq(candidatesTable.jobId, jobId),
          eq(candidatesTable.email, data.email.toLowerCase()),
        ),
      );
    if (duplicate) {
      res
        .status(409)
        .json({ error: "An application with this email already exists for this role" });
      return;
    }

    const [firstStage] = await db
      .select()
      .from(stagesTable)
      .where(eq(stagesTable.jobId, jobId))
      .orderBy(asc(stagesTable.position))
      .limit(1);
    if (!firstStage) {
      res
        .status(400)
        .json({ error: "This job is not yet accepting applications" });
      return;
    }

    // Validate answers against questions
    const questions = await db
      .select()
      .from(jobQuestionsTable)
      .where(eq(jobQuestionsTable.jobId, jobId));
    const qById = new Map(questions.map((q) => [q.id, q]));
    const answersByQid = new Map(
      data.answers.map((a) => [a.questionId, a.value] as const),
    );
    for (const q of questions) {
      const v = answersByQid.get(q.id);
      const isEmpty =
        v === undefined ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (q.required && isEmpty) {
        res.status(400).json({ error: `Please answer: ${q.label}` });
        return;
      }
      if (isEmpty) continue;
      if (q.type === "single_select") {
        if (typeof v !== "string" || !(q.options ?? []).includes(v)) {
          res.status(400).json({ error: `Invalid choice for: ${q.label}` });
          return;
        }
      } else if (q.type === "multi_select") {
        if (!Array.isArray(v) || v.some((x) => !(q.options ?? []).includes(x))) {
          res.status(400).json({ error: `Invalid choice for: ${q.label}` });
          return;
        }
      } else if (q.type === "text_digit") {
        if (typeof v !== "string" || !/^-?\d+(\.\d+)?$/.test(v.trim())) {
          res.status(400).json({ error: `${q.label} must be a number` });
          return;
        }
      } else if (q.type === "text_short") {
        if (typeof v !== "string" || v.length > 280) {
          res.status(400).json({ error: `${q.label} is too long` });
          return;
        }
      } else if (q.type === "text_long") {
        if (typeof v !== "string" || v.length > 5000) {
          res.status(400).json({ error: `${q.label} is too long` });
          return;
        }
      }
    }

    // If the applicant happens to be logged in as a candidate, link the row.
    const applicant = await getApplicant(req);

    const [c] = await db
      .insert(candidatesTable)
      .values({
        organizationId: job.organizationId,
        jobId,
        stageId: firstStage.id,
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        location: data.location || null,
        currentTitle: data.currentTitle || null,
        resumeUrl: data.resumeUrl || null,
        resumeKey: data.resumeKey || null,
        resumeFilename: data.resumeFilename || null,
        resumeMimeType: data.resumeMimeType || null,
        resumeSize: typeof data.resumeSize === "number" ? data.resumeSize : null,
        resumeUploadedAt: data.resumeKey ? new Date() : null,
        source: "careers",
        applicantId: applicant?.id ?? null,
      })
      .returning();

    await db
      .insert(candidateStagesTable)
      .values({ candidateId: c.id, stageId: firstStage.id });

    if (data.answers.length > 0) {
      const rows = data.answers
        .filter((a) => qById.has(a.questionId))
        .map((a) => ({
          candidateId: c.id,
          questionId: a.questionId,
          value:
            typeof a.value === "string"
              ? JSON.stringify(a.value)
              : JSON.stringify(a.value),
        }));
      if (rows.length > 0) {
        await db.insert(candidateAnswersTable).values(rows);
      }
    }

    if (data.coverLetter && data.coverLetter.trim()) {
      await db.insert(candidateNotesTable).values({
        candidateId: c.id,
        body: `Cover letter from applicant:\n\n${data.coverLetter.trim()}`,
        authorId: null,
      });
    }
    await db.insert(activityTable).values({
      organizationId: job.organizationId,
      type: "candidate_created",
      message: `${data.name} applied to ${job.title}`,
      candidateId: c.id,
      jobId: c.jobId,
    });
    res.status(201).json({ id: c.id });
  },
);

// Backwards-compat: list across all orgs
router.get("/public/jobs", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: jobsTable.id,
      title: jobsTable.title,
      description: jobsTable.description,
      status: jobsTable.status,
      location: jobsTable.location,
      employmentType: jobsTable.employmentType,
      department: jobsTable.department,
      requiredSkills: jobsTable.requiredSkills,
      minExperience: jobsTable.minExperience,
      organizationId: jobsTable.organizationId,
      organizationName: organizationsTable.name,
      organizationSlug: organizationsTable.slug,
      createdAt: jobsTable.createdAt,
    })
    .from(jobsTable)
    .leftJoin(
      organizationsTable,
      eq(organizationsTable.id, jobsTable.organizationId),
    )
    .where(eq(jobsTable.status, "open"))
    .orderBy(desc(jobsTable.createdAt));
  res.json(rows);
});

router.get("/candidate/applications", requireCandidate, async (req, res): Promise<void> => {
  const applicant = await getApplicant(req);
  if (!applicant) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const rows = await db
    .select({
      id: candidatesTable.id,
      jobId: candidatesTable.jobId,
      jobTitle: jobsTable.title,
      jobLocation: jobsTable.location,
      jobDepartment: jobsTable.department,
      organizationName: organizationsTable.name,
      organizationSlug: organizationsTable.slug,
      stageId: candidatesTable.stageId,
      stageName: stagesTable.name,
      stageColor: stagesTable.color,
      createdAt: candidatesTable.createdAt,
    })
    .from(candidatesTable)
    .leftJoin(jobsTable, eq(jobsTable.id, candidatesTable.jobId))
    .leftJoin(stagesTable, eq(stagesTable.id, candidatesTable.stageId))
    .leftJoin(
      organizationsTable,
      eq(organizationsTable.id, candidatesTable.organizationId),
    )
    .where(eq(candidatesTable.applicantId, applicant.id))
    .orderBy(desc(candidatesTable.createdAt));
  res.json(rows);
});

export default router;
