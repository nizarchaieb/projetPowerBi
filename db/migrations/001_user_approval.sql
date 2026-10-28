-- Run once on databases created before account approval was introduced.
ALTER TABLE users
  ADD COLUMN is_approved TINYINT(1) NOT NULL DEFAULT 0;

UPDATE users SET is_approved = 1 WHERE role = 'admin';
