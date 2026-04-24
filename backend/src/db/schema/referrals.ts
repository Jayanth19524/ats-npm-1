import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  candidateName: text("candidate_name").notNull(),
  candidateEmail: text("candidate_email").notNull(),
  candidateId: integer("candidate_id"),
  jobId: integer("job_id").notNull(),
  referredBy: integer("referred_by").notNull(),
  relationship: text("relationship"),
  notes: text("notes"),
  status: text("status").notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;
