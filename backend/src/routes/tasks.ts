import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  tasksTable,
  candidatesTable,
  profilesTable,
  activityTable,
} from "../db/index.js";
import {
  ListTasksQueryParams,
  ListTasksResponse,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
} from "../schemas/index.js";
import { orgIdOf } from "../lib/viewer";

const router: IRouter = Router();

router.get("/tasks", async (req, res): Promise<void> => {
  const q = ListTasksQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const filters = [eq(tasksTable.organizationId, orgId)];
  if (q.data.assignedTo !== undefined)
    filters.push(eq(tasksTable.assignedTo, q.data.assignedTo));
  if (q.data.candidateId !== undefined)
    filters.push(eq(tasksTable.candidateId, q.data.candidateId));
  if (q.data.status) filters.push(eq(tasksTable.status, q.data.status));

  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      dueDate: tasksTable.dueDate,
      assignedTo: tasksTable.assignedTo,
      assigneeName: profilesTable.name,
      candidateId: tasksTable.candidateId,
      candidateName: candidatesTable.name,
      status: tasksTable.status,
      createdAt: tasksTable.createdAt,
    })
    .from(tasksTable)
    .leftJoin(profilesTable, eq(profilesTable.id, tasksTable.assignedTo))
    .leftJoin(candidatesTable, eq(candidatesTable.id, tasksTable.candidateId))
    .where(and(...filters))
    .orderBy(desc(tasksTable.createdAt));
  res.json(ListTasksResponse.parse(rows));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [t] = await db
    .insert(tasksTable)
    .values({
      organizationId: orgId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      assignedTo: parsed.data.assignedTo ?? null,
      candidateId: parsed.data.candidateId ?? null,
    })
    .returning();
  res.status(201).json({
    id: t.id,
    title: t.title,
    description: t.description,
    dueDate: t.dueDate,
    assignedTo: t.assignedTo,
    assigneeName: null,
    candidateId: t.candidateId,
    candidateName: null,
    status: t.status,
    createdAt: t.createdAt,
  });
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (parsed.data.dueDate !== undefined)
    updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (parsed.data.assignedTo !== undefined)
    updates.assignedTo = parsed.data.assignedTo;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [t] = await db
    .update(tasksTable)
    .set(updates)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.organizationId, orgId)))
    .returning();
  if (!t) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (parsed.data.status === "done") {
    await db.insert(activityTable).values({
      organizationId: orgId,
      type: "task_completed",
      message: `Task completed: ${t.title}`,
      candidateId: t.candidateId,
    });
  }
  res.json(
    UpdateTaskResponse.parse({
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      assignedTo: t.assignedTo,
      assigneeName: null,
      candidateId: t.candidateId,
      candidateName: null,
      status: t.status,
      createdAt: t.createdAt,
    }),
  );
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
