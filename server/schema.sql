CREATE DATABASE IF NOT EXISTS contribtrack;
USE contribtrack;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'admin', 'client_user') NOT NULL DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_amount DECIMAL(15,2) DEFAULT 0,
  organization_id INT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE contributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  contributor_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status ENUM('pledge', 'partial', 'paid') DEFAULT 'pledge',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE payment_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contribution_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  recorded_by INT NOT NULL,
  FOREIGN KEY (contribution_id) REFERENCES contributions(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('event_assigned', 'contribution_added', 'payment_recorded', 'system') DEFAULT 'system',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_events_org ON events(organization_id);
CREATE INDEX idx_contributions_event ON contributions(event_id);
CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_payments_contribution ON payment_history(contribution_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ── Settings ──────────────────────────────────────────────────────
-- Scope encoding (both columns are NOT NULL to allow clean UNIQUE key):
--   Global  (super_admin) : user_id = 0,  organization_id = 0
--   Org     (admin)       : user_id = 0,  organization_id = <admin user_id>
--   Personal(client_user) : user_id = <user_id>, organization_id = 0
--
-- Migration for existing installs:
--   ALTER TABLE settings
--     ADD COLUMN organization_id INT NOT NULL DEFAULT 0 AFTER user_id,
--     DROP INDEX uniq_setting,
--     ADD UNIQUE KEY uniq_setting (user_id, organization_id, `key`),
--     ADD INDEX idx_settings_org (organization_id);
CREATE TABLE IF NOT EXISTS settings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT          NOT NULL DEFAULT 0,
  organization_id INT          NOT NULL DEFAULT 0,
  `key`           VARCHAR(100) NOT NULL,
  value           TEXT,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_setting (user_id, organization_id, `key`)
);

CREATE INDEX idx_settings_user ON settings(user_id);
CREATE INDEX idx_settings_org  ON settings(organization_id);
