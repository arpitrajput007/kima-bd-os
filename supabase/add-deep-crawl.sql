-- Opt-in deep crawl for sources whose real content is paginated, behind a
-- "Load More" button, or loaded via infinite scroll — the existing readUrl()
-- (Jina Reader) only ever sees whatever renders on first load, no
-- interaction. deep_crawl routes that specific source through Firecrawl's
-- /v2/scrape with a scroll+click action sequence instead. Off by default —
-- most sources are fine with a single-page read, and Firecrawl's Interact
-- mode costs more credits than a plain scrape, so this is per-source, not
-- a blanket default.
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS deep_crawl boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deep_crawl_max_actions int DEFAULT 5,
  ADD COLUMN IF NOT EXISTS deep_crawl_button_selector text;
