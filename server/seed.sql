USE contribtrack;
-- Generate a real bcrypt hash for password "Admin@2024"
-- Run: node generateHash.js
-- Then replace the hash below:
INSERT INTO users (name, email, password, role) VALUES
('Super Admin', 'md@cardhub.co.tz', '$2b$10$REPLACE_WITH_REAL_HASH', 'super_admin');
