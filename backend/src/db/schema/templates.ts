import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const emailTemplatesTable = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;
