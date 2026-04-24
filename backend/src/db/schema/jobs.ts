import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("open"),
  location: text("location").notNull().default(""),
  employmentType: text("employment_type").notNull().default("full_time"),
  department: text("department").notNull().default(""),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Job = typeof jobsTable.$inferSelect;
