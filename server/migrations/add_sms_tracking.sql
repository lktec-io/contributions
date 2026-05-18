-- Add per-contribution SMS tracking columns.
-- Safe to run multiple times: uses IF NOT EXISTS guards.

ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS sms_sent    TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_sent_at DATETIME   NULL;
