ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS resume_key text,
  ADD COLUMN IF NOT EXISTS resume_filename text,
  ADD COLUMN IF NOT EXISTS resume_mime_type text,
  ADD COLUMN IF NOT EXISTS resume_size integer,
  ADD COLUMN IF NOT EXISTS resume_uploaded_at timestamptz;
