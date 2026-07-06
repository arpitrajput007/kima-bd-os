-- Aergap was rebranded to Aerpolice (https://aerpolice.com/). This renames the
-- lead-fit column so it matches the `aerpolice_fit` field the app now reads/writes.
-- Run this in the Supabase SQL editor BEFORE deploying the updated app code —
-- until this runs, enrich-lead / the lead page will fail to save or read this field.
ALTER TABLE leads
  RENAME COLUMN aergap_fit TO aerpolice_fit;
