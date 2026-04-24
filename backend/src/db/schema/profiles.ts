import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("recruiter"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Profile = typeof profilesTable.$inferSelect;
