-- Migration: 0003_jobs_soft_delete.sql
-- Adds soft-delete support to the jobs table.
-- When a job is "deleted" via the API it gets a deleted_at timestamp instead
-- of being hard-deleted, so dashboard queries can simply filter deleted_at IS NULL.
 
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
 
-- Partial index so "active jobs" queries stay fast
CREATE INDEX IF NOT EXISTS idx_jobs_active
  ON jobs (organization_id)
  WHERE deleted_at IS NULL;
 