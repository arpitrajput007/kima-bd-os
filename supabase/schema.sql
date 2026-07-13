-- ============================================================
-- Kima BD OS — Supabase Schema Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- LEADS TABLE
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  website text,
  industry_category text,
  customer_category text[],
  product_to_sell text,
  region text,
  description text,
  business_model text,
  product_summary text,
  supported_chains_or_rails text,
  current_providers text,
  competitor_or_current_provider text,
  competitor_context text,
  pain_point text,
  pain_point_severity text check (pain_point_severity in ('critical', 'high', 'medium', 'low')),
  pain_point_evidence text,
  kima_fit text,
  aeredium_fit text,
  suggested_use_case text,
  trigger_reason text,
  risk_angle text,
  settlement_angle text,
  security_angle text,
  revenue_potential text,
  integration_feasibility text,
  source_url text,
  source_summary text,
  twitter_url text,
  telegram_url text,
  discord_url text,
  facts jsonb default '[]',
  assumptions jsonb default '[]',
  lead_score int check (lead_score >= 0 and lead_score <= 100),
  confidence_score int check (confidence_score >= 0 and confidence_score <= 100),
  priority text check (priority in ('excellent', 'qualified', 'needs_research', 'low_priority')),
  status text default 'new' check (status in ('new', 'researching', 'qualified', 'approved', 'rejected', 'contacted', 'replied', 'meeting_booked', 'archived', 'needs_more_research')),
  contacted_at timestamptz,
  last_contacted_at timestamptz,
  follow_up_stage smallint default 0,
  next_follow_up_at timestamptz,
  last_channel text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CONTACTS TABLE
-- ============================================================
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  name text,
  role text,
  company text,
  linkedin_url text,
  twitter_url text,
  telegram text,
  email text,
  contact_confidence text check (contact_confidence in ('high', 'medium', 'low', 'unknown')),
  reason_this_person text,
  source_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- OUTREACH MESSAGES TABLE
-- ============================================================
create table if not exists outreach_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  channel text check (channel in ('telegram', 'linkedin', 'twitter', 'email')),
  tone text check (tone in ('casual', 'professional', 'founder_to_founder', 'concise', 'strong_bd')),
  customer_category text,
  product_to_sell text,
  message text,
  followup_1 text,
  followup_2 text,
  objection_reply text,
  call_opening text,
  meeting_agenda text,
  status text default 'draft' check (status in ('draft', 'sent', 'delivered', 'replied', 'archived')),
  gmail_thread_id text,
  gmail_message_id text,
  gmail_message_id_header text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- SOURCES TABLE
-- ============================================================
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_type text check (source_type in ('website', 'google_search', 'twitter_profile', 'linkedin_company', 'telegram_group', 'rss_feed', 'defillama_category', 'crunchbase_list', 'ecosystem_directory', 'hackathon_directory', 'news_source', 'manual_list')),
  source_url_or_query text,
  target_industry_category text,
  target_customer_category text,
  frequency text check (frequency in ('daily', 'weekly', 'manual')),
  quality_rating text check (quality_rating in ('excellent', 'good', 'average', 'poor', 'unrated')),
  status text default 'active' check (status in ('active', 'paused')),
  notes text,
  last_run_at timestamptz,
  leads_generated int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- FEEDBACK MEMORY TABLE
-- ============================================================
create table if not exists feedback_memory (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  outreach_id uuid references outreach_messages(id) on delete set null,
  action_taken text check (action_taken in ('approved', 'rejected', 'edited', 'contacted', 'replied', 'meeting_booked', 'deal_closed', 'needs_more_research')),
  lead_quality text check (lead_quality in ('excellent', 'good', 'average', 'poor')),
  pain_point_accuracy text check (pain_point_accuracy in ('very_accurate', 'mostly_accurate', 'partially_accurate', 'inaccurate')),
  contact_accuracy text check (contact_accuracy in ('perfect', 'good', 'off', 'wrong')),
  message_quality text check (message_quality in ('excellent', 'good', 'needs_work', 'poor')),
  outcome text check (outcome in ('replied', 'meeting_booked', 'deal_in_progress', 'deal_closed', 'no_response', 'rejected_by_prospect', 'not_yet_sent')),
  rejection_reason text,
  arpit_notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- AGENT RULES TABLE
-- ============================================================
create table if not exists agent_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text check (rule_type in ('prioritize', 'reject', 'score_boost', 'score_penalty', 'outreach_style', 'source_preference')),
  rule text not null,
  weight int default 0,
  status text default 'active' check (status in ('active', 'inactive', 'pending_approval')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- LEARNING REPORTS TABLE
-- ============================================================
create table if not exists learning_reports (
  id uuid primary key default gen_random_uuid(),
  report_period text,
  summary text,
  winning_patterns jsonb default '[]',
  rejected_patterns jsonb default '[]',
  best_sources jsonb default '[]',
  worst_sources jsonb default '[]',
  best_customer_categories jsonb default '[]',
  worst_customer_categories jsonb default '[]',
  best_products_to_sell jsonb default '[]',
  scoring_changes_suggested jsonb default '[]',
  outreach_changes_suggested jsonb default '[]',
  new_rules_suggested jsonb default '[]',
  status text default 'pending_review' check (status in ('pending_review', 'approved', 'archived')),
  created_at timestamptz default now()
);

-- ============================================================
-- AGENT KNOWLEDGE TABLE (Long-Term Memory from Learning Sessions)
-- ============================================================
create table if not exists agent_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  source_type text check (source_type in ('file', 'url', 'text', 'image', 'screenshot')),
  source_name text,
  tags text[] default '{}',
  knowledge_type text default 'general',
  rules_created int default 0,
  sources_created int default 0,
  status text default 'active' check (status in ('active', 'archived')),
  created_at timestamptz default now()
);

-- ============================================================
-- VOICE CHAT TABLES (Voice conversations + memory)
-- ============================================================
create table if not exists voice_sessions (
  id uuid primary key default gen_random_uuid(),
  title text default 'New Conversation',
  summary text,
  message_count int default 0,
  knowledge_extracted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists voice_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references voice_sessions(id) on delete cascade,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at before update on leads
  for each row execute function update_updated_at_column();

create trigger outreach_messages_updated_at before update on outreach_messages
  for each row execute function update_updated_at_column();

create trigger sources_updated_at before update on sources
  for each row execute function update_updated_at_column();

create trigger agent_rules_updated_at before update on agent_rules
  for each row execute function update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table leads enable row level security;
alter table contacts enable row level security;
alter table outreach_messages enable row level security;
alter table sources enable row level security;
alter table feedback_memory enable row level security;
alter table agent_rules enable row level security;
alter table learning_reports enable row level security;
alter table agent_knowledge enable row level security;
alter table voice_sessions enable row level security;
alter table voice_messages enable row level security;


-- Allow anon and authenticated users full access (no login required — private local tool)
create policy "anon_full_access_leads" on leads for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_contacts" on contacts for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_outreach" on outreach_messages for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_sources" on sources for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_feedback" on feedback_memory for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_rules" on agent_rules for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_reports" on learning_reports for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_knowledge" on agent_knowledge for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_voice_sessions" on voice_sessions for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_voice_messages" on voice_messages for all to anon, authenticated using (true) with check (true);



-- ============================================================
-- SEED: DEFAULT AGENT RULES
-- ============================================================
insert into agent_rules (rule_type, rule, weight, status) values
  ('prioritize', 'Prioritize PSPs and cross-border fintechs with stablecoin settlement needs.', 20, 'active'),
  ('prioritize', 'Prioritize DEXs and wallets actively looking for cross-chain settlement or on/off-ramp.', 18, 'active'),
  ('prioritize', 'Prioritize companies that recently raised funding and are expanding.', 15, 'active'),
  ('prioritize', 'Prioritize projects using LayerZero for real value transfer (deposits, liquidity).', 20, 'active'),
  ('prioritize', 'Prioritize protocols recently hacked through bridge, relayer, oracle, or smart contract.', 25, 'active'),
  ('prioritize', 'Prioritize Web2 companies with cross-border payment pain (remittance, payroll, B2B).', 20, 'active'),
  ('score_boost', 'Increase score if the company recently announced fiat, wallet, stablecoin, or chain expansion.', 15, 'active'),
  ('score_boost', 'Increase score if company is actively hiring for payments, partnerships, or BD roles.', 10, 'active'),
  ('score_boost', 'Increase score if company uses MoonPay, Transak, Banxa, or similar and has shown friction.', 15, 'active'),
  ('score_boost', 'Increase score if company has identifiable decision maker (CEO, CTO, Head of Product, BD Lead).', 15, 'active'),
  ('score_boost', 'Increase score for iGaming platforms with high cross-border payment volume.', 12, 'active'),
  ('score_penalty', 'Reduce score if no clear decision maker is found.', -15, 'active'),
  ('score_penalty', 'Reduce score if the project has no active product or no user traction.', -20, 'active'),
  ('score_penalty', 'Reduce score if the only pain point is generic "cross-chain" without specifics.', -15, 'active'),
  ('reject', 'Reject NFT-only projects unless they have launchpad or payment use cases.', -30, 'active'),
  ('reject', 'Reject meme coins and pure speculation tokens.', -30, 'active'),
  ('reject', 'Reject dead or inactive projects (no updates in 6+ months).', -25, 'active'),
  ('reject', 'Reject leads where the only reason is they are in Web3.', -25, 'active'),
  ('reject', 'Reject leads with no source proof. Every lead must have a URL or evidence.', -30, 'active'),
  ('outreach_style', 'Outreach should start with their specific pain point, not with a generic Kima intro.', 0, 'active'),
  ('outreach_style', 'For hacked protocols, keep tone respectful and not opportunistic. Open with empathy.', 0, 'active'),
  ('outreach_style', 'For Fireblocks customers, position Kima/Aeredium as complementary settlement layer, not a custody replacement.', 0, 'active'),
  ('outreach_style', 'Always include the single API integration line naturally in the message body.', 0, 'active'),
  ('outreach_style', 'Messages should sound like Arpit: human, direct, sharp, not too formal, not generic.', 0, 'active'),
  ('source_preference', 'Prefer sources that surface companies with recent funding, expansion, or payment-related news.', 0, 'active'),
  ('source_preference', 'Prefer DeFiLlama, Crunchbase, and ecosystem directories over generic Web3 news.', 0, 'active');

-- ============================================================
-- SEED: DEFAULT SOURCES
-- ============================================================
insert into sources (source_name, source_type, source_url_or_query, target_industry_category, target_customer_category, frequency, quality_rating, status, notes) values
  -- LayerZero Customers
  ('LayerZero Ecosystem Projects', 'website', 'https://layerzero.network/ecosystem', 'Cross-border payment company, DEX, Perp DEX, RWA platform', 'LayerZero Customer', 'weekly', 'excellent', 'active', 'Direct ecosystem directory from LayerZero'),
  ('LayerZero + USDC Projects Search', 'google_search', '"LayerZero integration" "USDC"', 'DEX, Wallet, Stablecoin payment company', 'LayerZero Customer', 'weekly', 'good', 'active', 'Find projects integrating LayerZero for stablecoin movement'),
  ('Powered by LayerZero DeFi', 'google_search', '"powered by LayerZero" DeFi', 'DEX, Perp DEX, Launchpad', 'LayerZero Customer', 'weekly', 'good', 'active', 'Find DeFi projects explicitly powered by LayerZero'),
  ('LayerZero Cross-Chain DEX', 'google_search', '"LayerZero" "cross-chain" "DEX"', 'DEX, Perp DEX', 'LayerZero Customer', 'weekly', 'good', 'active', 'DEXes using LayerZero infrastructure'),
  ('LayerZero Omnichain Protocol', 'google_search', '"LayerZero" "omnichain" "protocol"', 'DEX, RWA platform, Wallet', 'LayerZero Customer', 'weekly', 'average', 'active', 'Omnichain projects'),
  ('LayerZero OFT Token Projects', 'google_search', '"LayerZero" "OFT" "token"', 'Exchange, Launchpad', 'LayerZero Customer', 'weekly', 'average', 'active', 'Projects using OFT standard'),
  
  -- Hacked Protocols
  ('Bridge Hacks 2025-2026', 'google_search', 'bridge hack DeFi protocol 2025 2026', 'DEX, Perp DEX, RWA platform', 'Hacked Protocol', 'daily', 'excellent', 'active', 'Find recent bridge hacks to reach out with Kima alternative'),
  ('Cross-Chain Bridge Exploits', 'google_search', 'cross-chain bridge exploit protocol', 'DEX, Wallet', 'Hacked Protocol', 'daily', 'excellent', 'active', 'Find exploit victims'),
  ('DeFi Bridge Exploit Latest', 'google_search', 'DeFi bridge exploit latest', 'DEX, Perp DEX', 'Hacked Protocol', 'daily', 'good', 'active', 'Recent DeFi exploit news'),
  ('Oracle Exploit Cross-Chain', 'google_search', 'oracle exploit cross-chain protocol', 'DEX, Perp DEX, RWA platform', 'Hacked Protocol', 'weekly', 'good', 'active', 'Oracle-related cross-chain exploits'),
  ('Relayer Exploit Bridge', 'google_search', 'relayer exploit bridge protocol', 'DEX, Wallet', 'Hacked Protocol', 'weekly', 'good', 'active', 'Relayer-related bridge exploits'),
  
  -- On/Off-Ramp Prospects
  ('Wallet Adding Fiat Onramp', 'google_search', 'wallet adding fiat onramp 2025', 'Wallet, Neobank', 'Needs On/Off Ramp', 'daily', 'excellent', 'active', 'Wallets actively integrating fiat onramps'),
  ('DEX Fiat Onramp Integration', 'google_search', 'DEX fiat onramp integration', 'DEX', 'Needs On/Off Ramp', 'daily', 'excellent', 'active', 'DEXes adding fiat support'),
  ('Launchpad Credit Card Crypto', 'google_search', 'launchpad credit card crypto investment', 'Launchpad', 'Needs On/Off Ramp', 'weekly', 'good', 'active', 'Launchpads needing card payments'),
  ('Stablecoin Onramp Provider', 'google_search', 'stablecoin onramp provider', 'On/off-ramp provider, Wallet', 'Needs On/Off Ramp', 'weekly', 'good', 'active', 'Stablecoin onramp companies'),
  ('USDT INR Onramp Offramp', 'google_search', 'USDT INR onramp off-ramp India', 'On/off-ramp provider, Fintech', 'Needs On/Off Ramp', 'weekly', 'excellent', 'active', 'India-specific ramp opportunities'),
  
  -- Fireblocks Customers
  ('Fireblocks Treasury Customers', 'google_search', '"Fireblocks" "treasury"', 'Custody/payment infrastructure company, Exchange', 'Fireblocks Customer', 'weekly', 'excellent', 'active', 'Companies using Fireblocks for treasury'),
  ('Fireblocks Stablecoin Customers', 'google_search', '"Fireblocks" "stablecoin"', 'PSP/payment gateway, Fintech', 'Fireblocks Customer', 'weekly', 'excellent', 'active', 'Fireblocks customers dealing with stablecoins'),
  ('Fireblocks Exchange Customers', 'google_search', '"Fireblocks" "exchange"', 'Exchange', 'Fireblocks Customer', 'weekly', 'good', 'active', 'Exchanges using Fireblocks'),
  ('Fireblocks Fintech Customers', 'google_search', '"Fireblocks" "fintech" "payments"', 'Fintech, PSP/payment gateway', 'Fireblocks Customer', 'weekly', 'good', 'active', 'Fintechs using Fireblocks'),
  
  -- Web2 Stablecoin Settlement
  ('Cross-Border Payment Stablecoin', 'google_search', 'cross-border payment company stablecoin settlement', 'Cross-border payment company', 'Web2 Stablecoin Settlement Customer', 'daily', 'excellent', 'active', 'Companies exploring stablecoin for cross-border'),
  ('B2B Payments Stablecoin', 'google_search', 'B2B payments stablecoin settlement 2025', 'Cross-border payment company, Fintech', 'Web2 Stablecoin Settlement Customer', 'daily', 'excellent', 'active', 'B2B payment companies exploring stablecoins'),
  ('Freelancer Payouts Stablecoin', 'google_search', 'freelancer payouts stablecoin USDT', 'Fintech, Web2 company with payment friction', 'Web2 Stablecoin Settlement Customer', 'weekly', 'good', 'active', 'Freelancer payout platforms'),
  ('Remittance Stablecoin Settlement', 'google_search', 'remittance stablecoin settlement USDC', 'Cross-border payment company', 'Web2 Stablecoin Settlement Customer', 'weekly', 'excellent', 'active', 'Remittance companies exploring stablecoins'),
  ('UAE India Payment Stablecoin', 'google_search', 'UAE India payment stablecoin corridor', 'Cross-border payment company, Fintech', 'Web2 Stablecoin Settlement Customer', 'weekly', 'excellent', 'active', 'UAE-India payment corridor'),
  ('Europe India Cross-Border Fintech', 'google_search', 'Europe India cross-border payment fintech stablecoin', 'Cross-border payment company, Neobank', 'Web2 Stablecoin Settlement Customer', 'weekly', 'good', 'active', 'EU-India payment companies'),
  ('Exporter Payments USDT', 'google_search', 'exporter payments USDT settlement B2B', 'Web2 company with payment friction', 'Web2 Stablecoin Settlement Customer', 'weekly', 'good', 'active', 'Export companies using USDT'),
  
  -- DeFiLlama
  ('DeFiLlama DEX Rankings', 'defillama_category', 'https://defillama.com/dexs', 'DEX, Perp DEX', 'LayerZero Customer, Needs On/Off Ramp', 'weekly', 'excellent', 'active', 'Top DEXes by volume - great prospect list'),
  ('DeFiLlama Bridge Rankings', 'defillama_category', 'https://defillama.com/bridges', 'DEX, Wallet', 'LayerZero Customer', 'weekly', 'excellent', 'active', 'Bridge projects - potential Kima alternatives'),
  ('DeFiLlama RWA Protocols', 'defillama_category', 'https://defillama.com/protocols/RWA', 'RWA platform', 'LayerZero Customer, Web2 Stablecoin Settlement Customer', 'weekly', 'excellent', 'active', 'RWA protocols needing settlement'),
  
  -- Ecosystem Directories
  ('Solana Ecosystem Projects', 'ecosystem_directory', 'https://solana.com/ecosystem', 'DEX, Wallet, Launchpad', 'Needs On/Off Ramp, LayerZero Customer', 'weekly', 'good', 'active', 'Solana ecosystem projects'),
  ('Cosmos Ecosystem Projects', 'ecosystem_directory', 'https://cosmos.network/ecosystem', 'DEX, Wallet', 'LayerZero Customer, Needs On/Off Ramp', 'weekly', 'good', 'active', 'Cosmos ecosystem projects');
