import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  referralsTable,
  jobsTable,
  profilesTable,
  activityTable,
} from "../db/index.js";
import {
  ListReferralsQueryParams,
  ListReferralsResponse,
  CreateReferralBody,
  UpdateReferralParams,
  UpdateReferralBody,
  UpdateReferralResponse,
} from "../schemas/index.js";
import { getViewer, orgIdOf } from "../lib/viewer";

const router: IRouter = Router();

router.get("/referrals", async (req, res): Promise<void> => {
  const q = ListReferralsQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const filters = [eq(referralsTable.organizationId, orgId)];
  if (q.data.referredBy !== undefined)
    filters.push(eq(referralsTable.referredBy, q.data.referredBy));
  const rows = await db
    .select({
      id: referralsTable.id,
      candidateName: referralsTable.candidateName,
      candidateEmail: referralsTable.candidateEmail,
      candidateId: referralsTable.candidateId,
      jobId: referralsTable.jobId,
      jobTitle: jobsTable.title,
      referredBy: referralsTable.referredBy,
      referrerName: profilesTable.name,
      relationship: referralsTable.relationship,
      notes: referralsTable.notes,
      status: referralsTable.status,
      createdAt: referralsTable.createdAt,
    })
    .from(referralsTable)
    .leftJoin(jobsTable, eq(jobsTable.id, referralsTable.jobId))
    .leftJoin(profilesTable, eq(profilesTable.id, referralsTable.referredBy))
    .where(and(...filters))
    .orderBy(desc(referralsTable.createdAt));
  res.json(
    ListReferralsResponse.parse(
      rows.map((r) => ({
        ...r,
        jobTitle: r.jobTitle ?? "Unknown",
        referrerName: r.referrerName ?? "Unknown",
      })),
    ),
  );
});

router.post("/referrals", async (req, res): Promise<void> => {
  const parsed = CreateReferralBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const viewer = await getViewer(req);
  const orgId = orgIdOf(req);
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, parsed.data.jobId), eq(jobsTable.organizationId, orgId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const [r] = await db
    .insert(referralsTable)
    .values({
      organizationId: orgId,
      candidateName: parsed.data.candidateName,
      candidateEmail: parsed.data.candidateEmail,
      jobId: parsed.data.jobId,
      referredBy: viewer.id,
      relationship: parsed.data.relationship ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "referral_submitted",
    message: `${viewer.name} referred ${r.candidateName}`,
    jobId: r.jobId,
  });
  res.status(201).json({
    ...r,
    jobTitle: job.title,
    referrerName: viewer.name,
  });
});

router.patch("/referrals/:id", async (req, res): Promise<void> => {
  const params = UpdateReferralParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateReferralBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [r] = await db
    .update(referralsTable)
    .set(parsed.data)
    .where(and(eq(referralsTable.id, params.data.id), eq(referralsTable.organizationId, orgId)))
    .returning();
  if (!r) {
    res.status(404).json({ error: "Referral not found" });
    return;
  }
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, r.jobId));
  const [referrer] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, r.referredBy));
  res.json(
    UpdateReferralResponse.parse({
      ...r,
      jobTitle: job?.title ?? "Unknown",
      referrerName: referrer?.name ?? "Unknown",
    }),
  );
});

export default router;
