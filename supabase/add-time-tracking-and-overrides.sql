-- ============================================================
-- Time Allocation tracking + manual KPI overrides for the
-- Monthly BD Performance report. Run this in the Supabase SQL editor.
-- ============================================================

-- 1. Time Allocation — where BD time went this month (company + responsibility + hours)
CREATE TABLE IF NOT EXISTS time_allocations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year     text NOT NULL,
  company_name   text NOT NULL,
  responsibility text NOT NULL,
  hours          numeric NOT NULL DEFAULT 0 CHECK (hours >= 0),
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_allocations_month_idx ON time_allocations(month_year);

CREATE OR REPLACE FUNCTION update_time_allocations_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS time_allocations_ts ON time_allocations;
CREATE TRIGGER time_allocations_ts
  BEFORE UPDATE ON time_allocations
  FOR EACH ROW EXECUTE FUNCTION update_time_allocations_ts();

ALTER TABLE time_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_time_allocations" ON time_allocations;
CREATE POLICY "allow_all_time_allocations"
  ON time_allocations FOR ALL USING (true) WITH CHECK (true);

-- 2. Manual overrides for the Overview KPI cards, keyed by month ("YYYY-MM")
CREATE TABLE IF NOT EXISTS monthly_report_overrides (
  month_year text PRIMARY KEY,
  overrides  jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE monthly_report_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_monthly_report_overrides" ON monthly_report_overrides;
CREATE POLICY "allow_all_monthly_report_overrides"
  ON monthly_report_overrides FOR ALL USING (true) WITH CHECK (true);
