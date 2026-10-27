-- ============================================
-- Route performance indexes for leads list/detail
-- ============================================

-- Non-admin lead lists usually filter by assignee and sort by newest.
CREATE INDEX IF NOT EXISTS idx_leads_assignee_created_at
  ON leads(assignee, created_at DESC);

-- Common admin filter combination: assignee + status + newest first.
CREATE INDEX IF NOT EXISTS idx_leads_assignee_status_created_at
  ON leads(assignee, status, created_at DESC);

-- Lead detail comments query filters by lead_id and orders by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_comments_lead_id_created_at
  ON comments(lead_id, created_at DESC);
