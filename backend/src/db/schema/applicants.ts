import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const applicantsTable = pgTable("applicants", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Applicant = typeof applicantsTable.$inferSelect;
