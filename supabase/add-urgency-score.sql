-- Urgency is a distinct signal from lead_score (general ICP fit). lead_score
-- blends fit + pain + trigger + integration ease into one number, so a
-- perfect-fit-but-no-trigger company can outrank a company that just got
-- hacked or just raised — even though the second one is who we should be
-- urgent about right now. This adds urgency_score as its own dimension,
-- driven specifically by trigger recency + pain severity.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS urgency_score int CHECK (urgency_score >= 0 AND urgency_score <= 100),
  ADD COLUMN IF NOT EXISTS urgency_reasoning text;
