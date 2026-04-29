-- Run this on your Digital Ocean MySQL cluster to add the logo_path column
-- (The full table creation is in Milestone 3/Basic SQL.sql)

-- Add logo_path column to show_event (if it doesn't already exist)
ALTER TABLE show_event ADD COLUMN IF NOT EXISTS logo_path VARCHAR(255) DEFAULT NULL;

-- Add show_date column alias for compatibility (show_event uses start_time for date in M3)
-- If your show_event table doesn't have show_date, run:
ALTER TABLE show_event ADD COLUMN IF NOT EXISTS show_date DATE DEFAULT NULL;
ALTER TABLE show_event ADD COLUMN IF NOT EXISTS venue VARCHAR(255) DEFAULT NULL;
ALTER TABLE show_event ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT NULL;
ALTER TABLE show_event ADD COLUMN IF NOT EXISTS show_name VARCHAR(255) DEFAULT NULL;

-- Hash existing plaintext passwords (run once, then delete this block)
-- UPDATE show_coordinator SET password = '$2b$10$PLACEHOLDER_RUN_register_to_create_accounts' WHERE password NOT LIKE '$2b$%';

-- Add card_color column so each show card can have a custom color
ALTER TABLE show_event ADD COLUMN IF NOT EXISTS card_color VARCHAR(20) DEFAULT '#111111';

-- Verify tables exist
SHOW TABLES;
