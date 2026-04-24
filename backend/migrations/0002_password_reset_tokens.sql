CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id serial PRIMARY KEY,
  kind text NOT NULL,
  user_id integer NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
