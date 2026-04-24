import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  candidatesTable,
  candidateStagesTable,
  candidateNotesTable,
  stagesTable,
  jobsTable,
  tasksTable,
  emailTemplatesTable,
  activityTable,
  profilesTable,
} from "../db/index.js";
import {
  ListCandidatesQueryParams,
  ListCandidatesResponse,
  CreateCandidateBody,
  GetCandidateParams,
  GetCandidateResponse,
  UpdateCandidateParams,
  UpdateCandidateBody,
  UpdateCandidateResponse,
  DeleteCandidateParams,
  MoveCandidateParams,
  MoveCandidateBody,
  MoveCandidateResponse,
  ListCandidateNotesParams,
  ListCandidateNotesResponse,
  CreateCandidateNoteParams,
  CreateCandidateNoteBody,
} from "../schemas/index.js";
import { getViewer, orgIdOf } from "../lib/viewer";
import { sendEmail, renderTemplate, isEmailConfigured } from "../lib/email";

const router: IRouter = Router();

async function firstStageId(jobId: number): Promise<number | null> {
  const [s] = await db
    .select()
    .from(stagesTable)
    .where(eq(stagesTable.jobId, jobId))
    .orderBy(asc(stagesTable.position))
    .limit(1);
  return s?.id ?? null;
}

router.get("/candidates", async (req, res): Promise<void> => {
  const q = ListCandidatesQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const filters = [eq(candidatesTable.organizationId, orgId)];
  if (q.data.jobId !== undefined)
    filters.push(eq(candidatesTable.jobId, q.data.jobId));
  if (q.data.stageId !== undefined)
    filters.push(eq(candidatesTable.stageId, q.data.stageId));
  if (q.data.search) {
    filters.push(
      or(
        ilike(candidatesTable.name, `%${q.data.search}%`),
        ilike(candidatesTable.email, `%${q.data.search}%`),
      )!,
    );
  }
  const rows = await db
    .select()
    .from(candidatesTable)
    .where(and(...filters))
    .orderBy(desc(candidatesTable.createdAt));
  res.json(ListCandidatesResponse.parse(rows));
});

router.post("/candidates", async (req, res): Promise<void> => {
  const parsed = CreateCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, parsed.data.jobId), eq(jobsTable.organizationId, orgId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const stageId = await firstStageId(parsed.data.jobId);
  if (!stageId) {
    res.status(400).json({ error: "Job has no stages defined" });
    return;
  }
  const [c] = await db
    .insert(candidatesTable)
    .values({
      organizationId: orgId,
      jobId: parsed.data.jobId,
      stageId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      location: parsed.data.location ?? null,
      currentTitle: parsed.data.currentTitle ?? null,
      resumeUrl: parsed.data.resumeUrl ?? null,
      resumeKey: parsed.data.resumeKey ?? null,
      resumeFilename: parsed.data.resumeFilename ?? null,
      resumeMimeType: parsed.data.resumeMimeType ?? null,
      resumeSize: parsed.data.resumeSize ?? null,
      resumeUploadedAt: parsed.data.resumeKey ? new Date() : null,
      source: parsed.data.source ?? "direct",
      rating: parsed.data.rating ?? null,
    })
    .returning();
  await db
    .insert(candidateStagesTable)
    .values({ candidateId: c.id, stageId, movedBy: null });
  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "candidate_created",
    message: `New candidate ${c.name} added`,
    candidateId: c.id,
    jobId: c.jobId,
  });
  res.status(201).json(c);
});

router.get("/candidates/:id", async (req, res): Promise<void> => {
  const params = GetCandidateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [c] = await db
    .select()
    .from(candidatesTable)
    .where(and(eq(candidatesTable.id, params.data.id), eq(candidatesTable.organizationId, orgId)));
  if (!c) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  const history = await db
    .select({
      id: candidateStagesTable.id,
      stageId: candidateStagesTable.stageId,
      stageName: stagesTable.name,
      movedAt: candidateStagesTable.movedAt,
      movedBy: candidateStagesTable.movedBy,
    })
    .from(candidateStagesTable)
    .leftJoin(stagesTable, eq(stagesTable.id, candidateStagesTable.stageId))
    .where(eq(candidateStagesTable.candidateId, c.id))
    .orderBy(desc(candidateStagesTable.movedAt));
  res.json(
    GetCandidateResponse.parse({
      ...c,
      history: history.map((h) => ({
        id: h.id,
        stageId: h.stageId,
        stageName: h.stageName ?? "Unknown",
        movedAt: h.movedAt,
        movedBy: h.movedBy,
      })),
    }),
  );
});

router.patch("/candidates/:id", async (req, res): Promise<void> => {
  const params = UpdateCandidateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const updates = {
    ...parsed.data,
    ...(parsed.data.resumeKey ? { resumeUploadedAt: new Date() } : {}),
    ...(parsed.data.resumeUrl === null
      ? {
          resumeKey: null,
          resumeFilename: null,
          resumeMimeType: null,
          resumeSize: null,
          resumeUploadedAt: null,
        }
      : {}),
  };
  const [c] = await db
    .update(candidatesTable)
    .set(updates)
    .where(and(eq(candidatesTable.id, params.data.id), eq(candidatesTable.organizationId, orgId)))
    .returning();
  if (!c) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  res.json(UpdateCandidateResponse.parse(c));
});

router.delete("/candidates/:id", async (req, res): Promise<void> => {
  const params = DeleteCandidateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  await db
    .delete(candidatesTable)
    .where(and(eq(candidatesTable.id, params.data.id), eq(candidatesTable.organizationId, orgId)));
  res.sendStatus(204);
});

router.post("/candidates/:id/move", async (req, res): Promise<void> => {
  const params = MoveCandidateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = MoveCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const viewer = await getViewer(req);
  const orgId = orgIdOf(req);
  const [stage] = await db
    .select()
    .from(stagesTable)
    .where(and(eq(stagesTable.id, parsed.data.stageId), eq(stagesTable.organizationId, orgId)));
  if (!stage) {
    res.status(404).json({ error: "Stage not found" });
    return;
  }
  const [c] = await db
    .update(candidatesTable)
    .set({ stageId: parsed.data.stageId })
    .where(and(eq(candidatesTable.id, params.data.id), eq(candidatesTable.organizationId, orgId)))
    .returning();
  if (!c) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  await db.insert(candidateStagesTable).values({
    candidateId: c.id,
    stageId: parsed.data.stageId,
    movedBy: viewer.id,
  });
  let emailSent = false;
  let taskCreated = false;
  if (stage.sendEmail && stage.templateId) {
    const [tpl] = await db
      .select()
      .from(emailTemplatesTable)
      .where(eq(emailTemplatesTable.id, stage.templateId));
    if (tpl) {
      const [job] = await db
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.id, c.jobId));
      const vars = {
        candidate_name: c.name,
        job_title: job?.title ?? "",
        stage_name: stage.name,
      };
      const result = await sendEmail({
        to: c.email,
        subject: renderTemplate(tpl.subject, vars),
        body: renderTemplate(tpl.body, vars),
      });
      emailSent = result.delivered;
    }
  }
  if (stage.createTask) {
    await db.insert(tasksTable).values({
      organizationId: orgId,
      title: stage.taskTitle ?? `Follow up with ${c.name} (${stage.name})`,
      candidateId: c.id,
      assignedTo: viewer.id,
      status: "todo",
    });
    taskCreated = true;
  }
  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "candidate_moved",
    message: `${c.name} moved to ${stage.name}`,
    candidateId: c.id,
    jobId: c.jobId,
  });
  res.json(
    MoveCandidateResponse.parse({
      candidate: c,
      automations: { emailSent, taskCreated },
    }),
  );
});

router.get("/candidates/:id/notes", async (req, res): Promise<void> => {
  const params = ListCandidateNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [c] = await db
    .select()
    .from(candidatesTable)
    .where(and(eq(candidatesTable.id, params.data.id), eq(candidatesTable.organizationId, orgId)));
  if (!c) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  const rows = await db
    .select({
      id: candidateNotesTable.id,
      candidateId: candidateNotesTable.candidateId,
      body: candidateNotesTable.body,
      authorId: candidateNotesTable.authorId,
      authorName: profilesTable.name,
      createdAt: candidateNotesTable.createdAt,
    })
    .from(candidateNotesTable)
    .leftJoin(profilesTable, eq(profilesTable.id, candidateNotesTable.authorId))
    .where(eq(candidateNotesTable.candidateId, params.data.id))
    .orderBy(desc(candidateNotesTable.createdAt));
  res.json(
    ListCandidateNotesResponse.parse(
      rows.map((r) => ({ ...r, authorName: r.authorName ?? "System" })),
    ),
  );
});

router.post("/candidates/:id/notes", async (req, res): Promise<void> => {
  const params = CreateCandidateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateCandidateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const viewer = await getViewer(req);
  const orgId = orgIdOf(req);
  const [c] = await db
    .select()
    .from(candidatesTable)
    .where(and(eq(candidatesTable.id, params.data.id), eq(candidatesTable.organizationId, orgId)));
  if (!c) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  const [n] = await db
    .insert(candidateNotesTable)
    .values({
      candidateId: params.data.id,
      body: parsed.data.body,
      authorId: viewer.id,
    })
    .returning();
  res.status(201).json({
    id: n.id,
    candidateId: n.candidateId,
    body: n.body,
    authorId: n.authorId,
    authorName: viewer.name,
    createdAt: n.createdAt,
  });
});

router.post("/candidates/:id/email", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid candidate id" });
    return;
  }
  const { templateId, subject, body } = req.body ?? {};
  const orgId = orgIdOf(req);
  const viewer = await getViewer(req);
  const [c] = await db
    .select()
    .from(candidatesTable)
    .where(and(eq(candidatesTable.id, id), eq(candidatesTable.organizationId, orgId)));
  if (!c) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  let finalSubject = typeof subject === "string" ? subject : "";
  let finalBody = typeof body === "string" ? body : "";
  if (templateId) {
    const tplId = Number(templateId);
    if (!Number.isInteger(tplId)) {
      res.status(400).json({ error: "Invalid template id" });
      return;
    }
    const [tpl] = await db
      .select()
      .from(emailTemplatesTable)
      .where(and(eq(emailTemplatesTable.id, tplId), eq(emailTemplatesTable.organizationId, orgId)));
    if (!tpl) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (!finalSubject) finalSubject = tpl.subject;
    if (!finalBody) finalBody = tpl.body;
  }
  if (!finalSubject || !finalBody) {
    res.status(400).json({ error: "A subject and message are required" });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, c.jobId));
  const vars = {
    candidate_name: c.name,
    job_title: job?.title ?? "",
    sender_name: viewer.name,
  };
  finalSubject = renderTemplate(finalSubject, vars);
  finalBody = renderTemplate(finalBody, vars);
  const result = await sendEmail({ to: c.email, subject: finalSubject, body: finalBody });
  await db.insert(candidateNotesTable).values({
    candidateId: c.id,
    body: result.delivered
      ? `Email sent to ${c.email}\nSubject: ${finalSubject}\n\n${finalBody}`
      : `Email NOT sent to ${c.email} (${result.reason || "no smtp"})\nSubject: ${finalSubject}\n\n${finalBody}`,
    authorId: viewer.id,
  });
  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "email_sent",
    message: result.delivered
      ? `${viewer.name} emailed ${c.name}: ${finalSubject}`
      : `${viewer.name} attempted to email ${c.name} (delivery failed: ${result.reason || "no smtp"})`,
    candidateId: c.id,
    jobId: c.jobId,
  });
  res.status(result.delivered ? 200 : 202).json({
    delivered: result.delivered,
    reason: result.reason ?? null,
    emailConfigured: isEmailConfigured(),
    to: c.email,
    subject: finalSubject,
  });
});

export default router;
