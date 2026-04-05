USE contribtrack;
-- Generate a real bcrypt hash for password "Admin@2024"
-- Run: node generateHash.js
-- Then replace the hash below:
INSERT INTO users (name, email, password, role) VALUES
('Super Admin', 'md@cardhub.co.tz', '$2b$10$GaNrFYAwVEeam7VT0AvGuOXgqHc5Coin6K7kzL0n9b5ekKqs1f2Ni', 'super_admin');
