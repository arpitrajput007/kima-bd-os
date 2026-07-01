-- ── Product / Feature Demand — Migration ────────────────────────
-- Run this in your Supabase SQL editor (Database → SQL Editor → New query)
--
-- Aggregates recurring product feedback & blockers collected on monthly_deals
-- (via the AI /api/ai/product-demand route) into a running, de-duplicated
-- backlog of feature/product gaps so the team can see what's actually
-- blocking deals and track whether it's been addressed.

CREATE TABLE IF NOT EXISTS product_feature_demand (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  title          text NOT NULL,
  description    text,
  category       text NOT NULL DEFAULT 'feature_requested',
  mention_count  integer NOT NULL DEFAULT 1,
  companies      text[] DEFAULT '{}',
  status         text NOT NULL DEFAULT 'open',   -- open | planned | shipped | wont_fix

  first_seen  timestamptz DEFAULT now(),
  last_seen   timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_feature_demand_status_idx   ON product_feature_demand(status);
CREATE INDEX IF NOT EXISTS product_feature_demand_category_idx ON product_feature_demand(category);

CREATE OR REPLACE FUNCTION update_product_feature_demand_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_feature_demand_ts ON product_feature_demand;
CREATE TRIGGER product_feature_demand_ts
  BEFORE UPDATE ON product_feature_demand
  FOR EACH ROW EXECUTE FUNCTION update_product_feature_demand_ts();

ALTER TABLE product_feature_demand ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_product_feature_demand" ON product_feature_demand;

CREATE POLICY "allow_all_product_feature_demand"
  ON product_feature_demand FOR ALL USING (true) WITH CHECK (true);
