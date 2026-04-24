import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  jobId: integer("job_id").notNull(),
  stageId: integer("stage_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  location: text("location"),
  currentTitle: text("current_title"),
  resumeUrl: text("resume_url"),
  resumeKey: text("resume_key"),
  resumeFilename: text("resume_filename"),
  resumeMimeType: text("resume_mime_type"),
  resumeSize: integer("resume_size"),
  resumeUploadedAt: timestamp("resume_uploaded_at", { withTimezone: true }),
  avatarUrl: text("avatar_url"),
  source: text("source").notNull().default("direct"),
  rating: integer("rating"),
  applicantId: integer("applicant_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const candidateStagesTable = pgTable("candidate_stages", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  stageId: integer("stage_id").notNull(),
  movedAt: timestamp("moved_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  movedBy: integer("moved_by"),
});

export const candidateNotesTable = pgTable("candidate_notes", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  body: text("body").notNull(),
  authorId: integer("author_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Candidate = typeof candidatesTable.$inferSelect;
export type CandidateStage = typeof candidateStagesTable.$inferSelect;
export type CandidateNote = typeof candidateNotesTable.$inferSelect;
