import { Router, type IRouter } from "express";
import { and, desc, eq, gte, sql, inArray } from "drizzle-orm";
import {
  db,
  jobsTable,
  candidatesTable,
  tasksTable,
  stagesTable,
  candidateStagesTable,
  activityTable,
} from "../db/index.js";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
} from "../schemas/index.js";
import { orgIdOf } from "../lib/viewer";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const orgId = orgIdOf(req);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [{ openJobs }] = await db
    .select({ openJobs: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(and(eq(jobsTable.status, "open"), eq(jobsTable.organizationId, orgId)));
  const [{ totalCandidates }] = await db
    .select({ totalCandidates: sql<number>`count(*)::int` })
    .from(candidatesTable)
    .where(eq(candidatesTable.organizationId, orgId));
  const [{ candidatesThisWeek }] = await db
    .select({ candidatesThisWeek: sql<number>`count(*)::int` })
    .from(candidatesTable)
    .where(and(gte(candidatesTable.createdAt, weekAgo), eq(candidatesTable.organizationId, orgId)));
  const [{ openTasks }] = await db
    .select({ openTasks: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(and(eq(tasksTable.status, "todo"), eq(tasksTable.organizationId, orgId)));

  const hiredStages = await db
    .select({ id: stagesTable.id })
    .from(stagesTable)
    .where(and(sql`lower(${stagesTable.name}) = 'hired'`, eq(stagesTable.organizationId, orgId)));
  const hiredIds = hiredStages.map((s) => s.id);
  let hiredThisMonth = 0;
  if (hiredIds.length > 0) {
    const [r] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(candidateStagesTable)
      .where(
        and(
          gte(candidateStagesTable.movedAt, monthStart),
          inArray(candidateStagesTable.stageId, hiredIds),
        ),
      );
    hiredThisMonth = Number(r.c);
  }

  let avgTimeToHireDays = 0;
  if (hiredIds.length > 0) {
    const result = await db.execute(
      sql`select coalesce(avg(extract(epoch from (cs.moved_at - c.created_at))/86400.0), 0)::float as avg_days
          from candidate_stages cs
          join candidates c on c.id = cs.candidate_id
          where cs.stage_id in ${hiredIds} and c.organization_id = ${orgId}`,
    );
    const row = (result as unknown as { rows?: Array<{ avg_days: number }> }).rows?.[0]
      ?? (Array.isArray(result) ? (result[0] as { avg_days: number } | undefined) : undefined);
    avgTimeToHireDays = Number(row?.avg_days ?? 0);
  }

  const pipeline = await db
    .select({
      stageName: stagesTable.name,
      count: sql<number>`count(${candidatesTable.id})::int`,
    })
    .from(stagesTable)
    .leftJoin(candidatesTable, eq(candidatesTable.stageId, stagesTable.id))
    .where(eq(stagesTable.organizationId, orgId))
    .groupBy(stagesTable.name)
    .orderBy(stagesTable.name);

  res.json(
    GetDashboardSummaryResponse.parse({
      openJobs: Number(openJobs),
      totalCandidates: Number(totalCandidates),
      candidatesThisWeek: Number(candidatesThisWeek),
      openTasks: Number(openTasks),
      hiredThisMonth,
      avgTimeToHireDays: Math.round(avgTimeToHireDays * 10) / 10,
      pipelineByStage: pipeline.map((p) => ({
        stageName: p.stageName,
        count: Number(p.count),
      })),
    }),
  );
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const orgId = orgIdOf(req);
  const rows = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.organizationId, orgId))
    .orderBy(desc(activityTable.createdAt))
    .limit(25);
  const allowed = new Set([
    "candidate_created",
    "candidate_moved",
    "task_completed",
    "job_created",
    "referral_submitted",
  ]);
  res.json(
    GetRecentActivityResponse.parse(
      rows.map((r) => ({
        id: String(r.id),
        type: allowed.has(r.type) ? r.type : "candidate_moved",
        message: r.message,
        candidateId: r.candidateId,
        jobId: r.jobId,
        createdAt: r.createdAt,
      })),
    ),
  );
});

export default router;
