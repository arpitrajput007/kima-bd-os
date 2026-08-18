-- AERseal is a third, co-equal lead-gen product alongside AER360 and
-- Aerpolice (2026-08-19): threshold-controlled custody for a deployed smart
-- contract's privileged admin/owner role (upgrade, mint, pause, freeze,
-- oracle, bridge config, role management) — distinct from AER360 (wallet/
-- fund custody) and Aerpolice (AI-agent action governance). Mirrors the
-- existing aerpolice_fit / aeredium_fit text columns so productFocusDirective()
-- and outreach's leadContextBlock() can key off it the same way.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS aerseal_fit text;
