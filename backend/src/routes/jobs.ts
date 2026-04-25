import { Router, type IRouter } from "express";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  jobsTable,
  stagesTable,
  candidatesTable,
} from "../db/index.js";
import {
  ListJobsQueryParams,
  ListJobsResponse,
  CreateJobBody,
  GetJobParams,
  GetJobResponse,
  UpdateJobParams,
  UpdateJobBody,
  UpdateJobResponse,
  DeleteJobParams,
  GetJobStatsParams,
  GetJobStatsResponse,
} from "../schemas/index.js";
import { getViewer, orgIdOf } from "../lib/viewer";

const router: IRouter = Router();

router.get("/jobs", async (req, res): Promise<void> => {
  const q = ListJobsQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  // FIX: exclude soft-deleted jobs from list
  const filters = [
    eq(jobsTable.organizationId, orgId),
    isNull(jobsTable.deletedAt),
  ];
  if (q.data.status) filters.push(eq(jobsTable.status, q.data.status));
  const rows = await db
    .select()
    .from(jobsTable)
    .where(and(...filters))
    .orderBy(jobsTable.createdAt);
  res.json(ListJobsResponse.parse(rows));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const viewer = await getViewer(req);
  const orgId = orgIdOf(req);
  const [job] = await db
    .insert(jobsTable)
    .values({ ...parsed.data, createdBy: viewer.id, organizationId: orgId })
    .returning();
  res.status(201).json(GetJobResponse.parse(job));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.id, params.data.id),
        eq(jobsTable.organizationId, orgId),
        // FIX: treat soft-deleted jobs as not found
        isNull(jobsTable.deletedAt),
      ),
    );
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(GetJobResponse.parse(job));
});

router.patch("/jobs/:id", async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [job] = await db
    .update(jobsTable)
    .set(parsed.data)
    .where(
      and(
        eq(jobsTable.id, params.data.id),
        eq(jobsTable.organizationId, orgId),
        // FIX: prevent patching a soft-deleted job
        isNull(jobsTable.deletedAt),
      ),
    )
    .returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(UpdateJobResponse.parse(job));
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  // FIX: soft-delete the job by setting deleted_at instead of hard-deleting.
  // This keeps the row (and its FK integrity) intact while excluding it from
  // all queries that filter on isNull(jobsTable.deletedAt).
  await db
    .update(jobsTable)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(jobsTable.id, params.data.id),
        eq(jobsTable.organizationId, orgId),
        isNull(jobsTable.deletedAt), // no-op if already deleted
      ),
    );
  res.sendStatus(204);
});

router.get("/jobs/:id/stats", async (req, res): Promise<void> => {
  const params = GetJobStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.id, params.data.id),
        eq(jobsTable.organizationId, orgId),
        isNull(jobsTable.deletedAt),
      ),
    );
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const stages = await db
    .select()
    .from(stagesTable)
    .where(eq(stagesTable.jobId, params.data.id))
    .orderBy(asc(stagesTable.position));
  const counts = await db
    .select({
      stageId: candidatesTable.stageId,
      count: sql<number>`count(*)::int`,
    })
    .from(candidatesTable)
    .where(eq(candidatesTable.jobId, params.data.id))
    .groupBy(candidatesTable.stageId);
  const countMap = new Map(counts.map((c) => [c.stageId, Number(c.count)]));
  const byStage = stages.map((s) => ({
    stageId: s.id,
    stageName: s.name,
    count: countMap.get(s.id) ?? 0,
  }));
  const total = byStage.reduce((a, b) => a + b.count, 0);
  res.json(
    GetJobStatsResponse.parse({
      jobId: params.data.id,
      totalCandidates: total,
      byStage,
    }),
  );
});

export default router;