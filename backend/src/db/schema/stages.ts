import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const stagesTable = pgTable("stages", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  jobId: integer("job_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  color: text("color").notNull().default("#6366f1"),
  sendEmail: boolean("send_email").notNull().default(false),
  createTask: boolean("create_task").notNull().default(false),
  templateId: integer("template_id"),
  taskTitle: text("task_title"),
});

export type Stage = typeof stagesTable.$inferSelect;
