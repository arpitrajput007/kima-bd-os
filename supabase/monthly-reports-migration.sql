-- ── Monthly BD Performance Reports — Migration ──────────────────
-- Run this in your Supabase SQL editor (Database → SQL Editor → New query)

-- 1. Monthly Deals table
CREATE TABLE IF NOT EXISTS monthly_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company Information
  company_name          text NOT NULL,
  individual_name       text,
  designation           text,
  website               text,
  industry              text,
  country               text,

  -- Lead Classification
  lead_type             text,

  -- Opportunity Details
  requirement           text,
  problem_statement     text,
  products_interested   text[]  DEFAULT '{}',
  products_proposed     text[]  DEFAULT '{}',
  status                text    NOT NULL DEFAULT 'new',
  expected_close_date   date,

  -- Business Potential
  expected_monthly_volume   text,
  expected_yearly_volume    text,
  estimated_revenue         text,
  geographic_corridor       text,
  use_case                  text,
  end_users_count           text,
  strategic_importance      text DEFAULT 'medium',

  -- Business Impact
  business_impact       text,
  why_valuable          text,
  best_product_fit      text,
  long_term_value       text,

  -- Structured data (JSONB — flexible, forward-compatible)
  product_feedback      jsonb DEFAULT '{}',
  blockers              jsonb DEFAULT '[]',

  -- Outreach
  outreach_channel      text,

  -- Metadata
  month_year            text NOT NULL,  -- "YYYY-MM"
  owner                 text,
  notes                 text,

  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 2. Deal Activities (timeline)
CREATE TABLE IF NOT EXISTS deal_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid NOT NULL REFERENCES monthly_deals(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  content       text,
  channel       text,
  next_follow_up_date date,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS monthly_deals_month_year_idx  ON monthly_deals(month_year);
CREATE INDEX IF NOT EXISTS monthly_deals_status_idx       ON monthly_deals(status);
CREATE INDEX IF NOT EXISTS monthly_deals_company_idx      ON monthly_deals(company_name);
CREATE INDEX IF NOT EXISTS deal_activities_deal_id_idx    ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS deal_activities_type_idx       ON deal_activities(activity_type);

-- 4. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_monthly_deals_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS monthly_deals_ts ON monthly_deals;
CREATE TRIGGER monthly_deals_ts
  BEFORE UPDATE ON monthly_deals
  FOR EACH ROW EXECUTE FUNCTION update_monthly_deals_ts();

-- 5. RLS (open — same pattern as rest of the app which disables auth RLS)
ALTER TABLE monthly_deals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_monthly_deals"    ON monthly_deals;
DROP POLICY IF EXISTS "allow_all_deal_activities"  ON deal_activities;

CREATE POLICY "allow_all_monthly_deals"
  ON monthly_deals FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_deal_activities"
  ON deal_activities FOR ALL USING (true) WITH CHECK (true);
