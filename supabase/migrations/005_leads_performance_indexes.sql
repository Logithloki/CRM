-- ============================================
-- Leads performance indexes for large datasets
-- ============================================

-- Enable trigram support for fast ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Filter/sort helpers
CREATE INDEX IF NOT EXISTS idx_leads_assignee ON leads(assignee);
CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON leads(status, created_at DESC);

-- Search helpers for full_name/email/phone ILIKE queries
CREATE INDEX IF NOT EXISTS idx_leads_full_name_trgm ON leads USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON leads USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON leads USING gin (phone_number gin_trgm_ops);
