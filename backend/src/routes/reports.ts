import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  candidatesTable,
  stagesTable,
} from "../db/index.js";
import {
  GetPipelineReportQueryParams,
  GetPipelineReportResponse,
  GetSourceReportResponse,
  GetTimeseriesReportQueryParams,
  GetTimeseriesReportResponse,
} from "../schemas/index.js";
import { orgIdOf } from "../lib/viewer";

const router: IRouter = Router();

router.get("/reports/pipeline", async (req, res): Promise<void> => {
  const q = GetPipelineReportQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const stageFilters = [eq(stagesTable.organizationId, orgId)];
  if (q.data.jobId !== undefined) stageFilters.push(eq(stagesTable.jobId, q.data.jobId));

  const rows = await db
    .select({
      stageName: stagesTable.name,
      position: stagesTable.position,
      count: sql<number>`count(${candidatesTable.id})::int`,
    })
    .from(stagesTable)
    .leftJoin(
      candidatesTable,
      and(
        eq(candidatesTable.stageId, stagesTable.id),
        q.data.jobId !== undefined
          ? eq(candidatesTable.jobId, q.data.jobId)
          : undefined,
      ),
    )
    .where(and(...stageFilters))
    .groupBy(stagesTable.name, stagesTable.position)
    .orderBy(stagesTable.position);
  const max = rows.length > 0 ? Number(rows[0].count) : 0;
  res.json(
    GetPipelineReportResponse.parse({
      stages: rows.map((r) => ({
        stageName: r.stageName,
        count: Number(r.count),
        conversionRate: max > 0 ? Math.round((Number(r.count) / max) * 100) : 0,
      })),
    }),
  );
});

router.get("/reports/sources", async (req, res): Promise<void> => {
  const orgId = orgIdOf(req);
  const rows = await db
    .select({
      source: candidatesTable.source,
      count: sql<number>`count(*)::int`,
    })
    .from(candidatesTable)
    .where(eq(candidatesTable.organizationId, orgId))
    .groupBy(candidatesTable.source);
  res.json(
    GetSourceReportResponse.parse(
      rows.map((r) => ({ source: r.source, count: Number(r.count) })),
    ),
  );
});

router.get("/reports/timeseries", async (req, res): Promise<void> => {
  const q = GetTimeseriesReportQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const days = q.data.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const candRows = await db.execute(
    sql`select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as d,
               count(*)::int as c
        from candidates
        where created_at >= ${since} and organization_id = ${orgId}
        group by d order by d`,
  );
  const hireRows = await db.execute(
    sql`select to_char(date_trunc('day', cs.moved_at), 'YYYY-MM-DD') as d,
               count(*)::int as c
        from candidate_stages cs
        join stages s on s.id = cs.stage_id
        join candidates c on c.id = cs.candidate_id
        where cs.moved_at >= ${since} and lower(s.name) = 'hired' and c.organization_id = ${orgId}
        group by d order by d`,
  );
  const cMap = new Map<string, number>(
    (candRows.rows as Array<{ d: string; c: number }>).map((r) => [r.d, Number(r.c)]),
  );
  const hMap = new Map<string, number>(
    (hireRows.rows as Array<{ d: string; c: number }>).map((r) => [r.d, Number(r.c)]),
  );
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    points.push({
      date: key,
      candidates: cMap.get(key) ?? 0,
      hires: hMap.get(key) ?? 0,
    });
  }
  res.json(GetTimeseriesReportResponse.parse(points));
});

export default router;
