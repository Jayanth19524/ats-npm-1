import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, stagesTable, jobsTable } from "../db/index.js";
import {
  ListStagesParams,
  ListStagesResponse,
  CreateStageParams,
  CreateStageBody,
  UpdateStageParams,
  UpdateStageBody,
  UpdateStageResponse,
  DeleteStageParams,
} from "../schemas/index.js";
import { orgIdOf } from "../lib/viewer";

const router: IRouter = Router();

async function ensureJobInOrg(jobId: number, orgId: number): Promise<boolean> {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, jobId), eq(jobsTable.organizationId, orgId)));
  return !!job;
}

router.get("/jobs/:jobId/stages", async (req, res): Promise<void> => {
  const params = ListStagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  if (!(await ensureJobInOrg(params.data.jobId, orgId))) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const rows = await db
    .select()
    .from(stagesTable)
    .where(eq(stagesTable.jobId, params.data.jobId))
    .orderBy(asc(stagesTable.position));
  res.json(ListStagesResponse.parse(rows));
});

router.post("/jobs/:jobId/stages", async (req, res): Promise<void> => {
  const params = CreateStageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateStageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  if (!(await ensureJobInOrg(params.data.jobId, orgId))) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${stagesTable.position}), -1)::int` })
    .from(stagesTable)
    .where(eq(stagesTable.jobId, params.data.jobId));
  const [stage] = await db
    .insert(stagesTable)
    .values({
      organizationId: orgId,
      jobId: params.data.jobId,
      name: parsed.data.name,
      color: parsed.data.color ?? "#6366f1",
      position: Number(max) + 1,
      sendEmail: parsed.data.sendEmail ?? false,
      createTask: parsed.data.createTask ?? false,
      templateId: parsed.data.templateId ?? null,
      taskTitle: parsed.data.taskTitle ?? null,
    })
    .returning();
  res.status(201).json(stage);
});

router.patch("/stages/:id", async (req, res): Promise<void> => {
  const params = UpdateStageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateStageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [stage] = await db
    .update(stagesTable)
    .set(parsed.data)
    .where(and(eq(stagesTable.id, params.data.id), eq(stagesTable.organizationId, orgId)))
    .returning();
  if (!stage) {
    res.status(404).json({ error: "Stage not found" });
    return;
  }
  res.json(UpdateStageResponse.parse(stage));
});

router.delete("/stages/:id", async (req, res): Promise<void> => {
  const params = DeleteStageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  await db
    .delete(stagesTable)
    .where(and(eq(stagesTable.id, params.data.id), eq(stagesTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
