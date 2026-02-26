-- ============================================
-- CRM Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create ENUMs
CREATE TYPE lead_status AS ENUM (
  'New',
  'No Answer',
  'Follow Up',
  'Unqualified',
  'Closed',
  'Call Later'
);

CREATE TYPE lead_language AS ENUM (
  'Hindi',
  'Other'
);

-- 2. Create leads table
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  status lead_status NOT NULL DEFAULT 'New',
  language lead_language NOT NULL DEFAULT 'Hindi',
  country TEXT,
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_updated_at ON leads(updated_at);
CREATE INDEX idx_leads_full_name ON leads(full_name);
CREATE INDEX idx_leads_email ON leads(email);

CREATE INDEX idx_comments_lead_id ON comments(lead_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- 5. Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Leads: authenticated users can SELECT
CREATE POLICY "Authenticated users can view leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (true);

-- Comments: authenticated users can SELECT
CREATE POLICY "Authenticated users can view comments"
  ON comments
  FOR SELECT
  TO authenticated
  USING (true);

-- Comments: authenticated users can INSERT
CREATE POLICY "Authenticated users can insert comments"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 7. Auto-update updated_at on leads
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Enable Realtime for comments (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
