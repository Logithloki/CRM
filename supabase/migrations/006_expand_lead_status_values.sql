-- ============================================
-- Expand lead_status enum values to match app
-- ============================================

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'Hindi Language';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'Other Language';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'Retention';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'Not Interested';
