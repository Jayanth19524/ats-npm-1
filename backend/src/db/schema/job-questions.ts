import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const jobQuestionsTable = pgTable("job_questions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  position: integer("position").notNull().default(0),
  label: text("label").notNull(),
  // 'single_select' | 'multi_select' | 'text_short' | 'text_digit' | 'text_long'
  type: text("type").notNull(),
  options: text("options").array(),
  required: boolean("required").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const candidateAnswersTable = pgTable("candidate_answers", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  questionId: integer("question_id").notNull(),
  // Stored as JSON-encoded string. Single-select/text => string. Multi-select => array.
  value: text("value").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type JobQuestion = typeof jobQuestionsTable.$inferSelect;
export type CandidateAnswer = typeof candidateAnswersTable.$inferSelect;

export const QUESTION_TYPES = [
  "single_select",
  "multi_select",
  "text_short",
  "text_digit",
  "text_long",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
