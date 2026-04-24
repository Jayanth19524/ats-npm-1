import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  candidateId: integer("candidate_id"),
  jobId: integer("job_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Activity = typeof activityTable.$inferSelect;
