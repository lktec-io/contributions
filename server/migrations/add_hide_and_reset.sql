-- ── Migration: add reset-password fields to users ─────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token   VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS reset_expires DATETIME     NULL;

-- ── Migration: add soft-delete (hide) fields to contributions ────────────
ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_at DATETIME NULL;

CREATE INDEX IF NOT EXISTS idx_contributions_hidden ON contributions(is_hidden);
