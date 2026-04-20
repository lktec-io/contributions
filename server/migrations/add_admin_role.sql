-- Migration: Add 'admin' role alongside existing 'super_admin' and 'client_user'
-- Run once on the production database.

ALTER TABLE users
  MODIFY COLUMN role ENUM('super_admin', 'admin', 'client_user') NOT NULL DEFAULT 'admin';

-- Verify
-- SELECT DISTINCT role FROM users;
