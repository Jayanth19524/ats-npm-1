import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  jobsTable,
  stagesTable,
  candidatesTable,
  candidateStagesTable,
  candidateNotesTable,
  activityTable,
  organizationsTable,
} from "../db/index.js";
import { getApplicant, requireCandidate } from "../lib/viewer";

const router: IRouter = Router();

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

router.post(
  "/public/agencies/:slug/jobs/:id/apply",
  requireCandidate,
  async (req, res): Promise<void> => {
    const slug = String(req.params.slug || "");
    const jobId = Number(req.params.id);
    if (!Number.isInteger(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }
    const applicant = await getApplicant(req);
    if (!applicant) {
      res.status(401).json({ error: "Sign in required" });
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
    const [existing] = await db
      .select()
      .from(candidatesTable)
      .where(
        and(
          eq(candidatesTable.jobId, jobId),
          eq(candidatesTable.applicantId, applicant.id),
        ),
      );
    if (existing) {
      res.status(409).json({ error: "You have already applied to this role" });
      return;
    }
    const [firstStage] = await db
      .select()
      .from(stagesTable)
      .where(eq(stagesTable.jobId, jobId))
      .orderBy(asc(stagesTable.position))
      .limit(1);
    if (!firstStage) {
      res.status(400).json({ error: "This job is not yet accepting applications" });
      return;
    }
    const {
      coverLetter,
      resumeUrl,
      resumeKey,
      resumeFilename,
      resumeMimeType,
      resumeSize,
      currentTitle,
    } = req.body ?? {};
    const [c] = await db
      .insert(candidatesTable)
      .values({
        organizationId: job.organizationId,
        jobId,
        stageId: firstStage.id,
        name: applicant.name,
        email: applicant.email,
        phone: applicant.phone,
        location: applicant.location,
        currentTitle:
          typeof currentTitle === "string" && currentTitle ? currentTitle : null,
        resumeUrl: typeof resumeUrl === "string" && resumeUrl ? resumeUrl : null,
        resumeKey: typeof resumeKey === "string" && resumeKey ? resumeKey : null,
        resumeFilename:
          typeof resumeFilename === "string" && resumeFilename ? resumeFilename : null,
        resumeMimeType:
          typeof resumeMimeType === "string" && resumeMimeType ? resumeMimeType : null,
        resumeSize: typeof resumeSize === "number" ? resumeSize : null,
        resumeUploadedAt:
          typeof resumeKey === "string" && resumeKey ? new Date() : null,
        source: "direct",
        applicantId: applicant.id,
      })
      .returning();
    await db
      .insert(candidateStagesTable)
      .values({ candidateId: c.id, stageId: firstStage.id });
    if (typeof coverLetter === "string" && coverLetter.trim()) {
      await db.insert(candidateNotesTable).values({
        candidateId: c.id,
        body: `Cover letter from applicant:\n\n${coverLetter.trim()}`,
        authorId: null,
      });
    }
    await db.insert(activityTable).values({
      organizationId: job.organizationId,
      type: "candidate_created",
      message: `${applicant.name} applied to ${job.title}`,
      candidateId: c.id,
      jobId: c.jobId,
    });
    res.status(201).json(c);
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
