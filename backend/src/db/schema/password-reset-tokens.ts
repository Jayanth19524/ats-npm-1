import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  userId: integer("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
