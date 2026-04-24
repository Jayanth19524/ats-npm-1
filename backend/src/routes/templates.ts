import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, emailTemplatesTable } from "../db/index.js";
import {
  ListTemplatesResponse,
  CreateTemplateBody,
  UpdateTemplateParams,
  UpdateTemplateBody,
  UpdateTemplateResponse,
  DeleteTemplateParams,
} from "../schemas/index.js";
import { orgIdOf } from "../lib/viewer";

const router: IRouter = Router();

router.get("/templates", async (req, res): Promise<void> => {
  const orgId = orgIdOf(req);
  const rows = await db
    .select()
    .from(emailTemplatesTable)
    .where(eq(emailTemplatesTable.organizationId, orgId))
    .orderBy(desc(emailTemplatesTable.createdAt));
  res.json(ListTemplatesResponse.parse(rows));
});

router.post("/templates", async (req, res): Promise<void> => {
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [t] = await db
    .insert(emailTemplatesTable)
    .values({ ...parsed.data, organizationId: orgId })
    .returning();
  res.status(201).json(t);
});

router.patch("/templates/:id", async (req, res): Promise<void> => {
  const params = UpdateTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  const [t] = await db
    .update(emailTemplatesTable)
    .set(parsed.data)
    .where(and(eq(emailTemplatesTable.id, params.data.id), eq(emailTemplatesTable.organizationId, orgId)))
    .returning();
  if (!t) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(UpdateTemplateResponse.parse(t));
});

router.delete("/templates/:id", async (req, res): Promise<void> => {
  const params = DeleteTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = orgIdOf(req);
  await db
    .delete(emailTemplatesTable)
    .where(and(eq(emailTemplatesTable.id, params.data.id), eq(emailTemplatesTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
