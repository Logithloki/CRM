-- ============================================
-- Migration: Add lead source (WTP / STP)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add enum type for source
DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM ('WTP', 'STP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add source column, default all existing rows to 'STP'
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source lead_source NOT NULL DEFAULT 'STP';

-- 3. Mark all currently existing leads as STP (already the default,
--    but this makes intent explicit)
UPDATE leads SET source = 'STP' WHERE source IS DISTINCT FROM 'STP';

-- 4. Index for fast filtering by source
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
