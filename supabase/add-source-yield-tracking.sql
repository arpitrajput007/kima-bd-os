-- leads_generated already tracks output, but there was no persisted count of
-- INPUT — how many companies actually got a full deepResearch() AI call (the
-- real cost driver: one Sonnet call + Hunter + Exa + homepage crawl per
-- company). Without it you can't tell "this source produces few leads because
-- it rarely surfaces candidates" (cheap, fine) apart from "this source burns
-- 20 research calls per run and saves 0" (expensive, should be paused).
-- companies_evaluated is cumulative across all runs, same convention as the
-- existing leads_generated. total_runs lets the UI show an average yield per
-- run too, not just a lifetime ratio.
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS companies_evaluated int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_runs int DEFAULT 0;
