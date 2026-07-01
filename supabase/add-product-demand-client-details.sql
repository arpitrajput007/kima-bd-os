-- ── Product / Feature Demand — client detail breakdown ──────────
-- Run this in your Supabase SQL editor AFTER add-product-feature-demand.sql
--
-- Adds a per-client breakdown (company, monthly volume, revenue opportunity,
-- strategic importance) to each demand item, so you can see exactly how much
-- volume/revenue is tied up behind a missing feature/product — not just a
-- mention count.

ALTER TABLE product_feature_demand
  ADD COLUMN IF NOT EXISTS client_details jsonb DEFAULT '[]';
