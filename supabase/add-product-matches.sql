-- Both qualify-lead and enrich-lead already evaluate every product in the
-- catalog (Kima UPR/LaaS/DvP, Aeredium L1/AERLink/AERKey, Aerpolice Identity/
-- Gate/Audit) per lead, but had nowhere to store the full match matrix — it
-- was shown once in the "Add Lead" review step, then discarded on save.
-- This column persists it so the lead page can always show which product
-- (including AERKey) is the best fit, not just the 3 top-level company verdicts.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS product_matches jsonb;
