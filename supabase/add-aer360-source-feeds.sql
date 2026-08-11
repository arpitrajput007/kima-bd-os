-- New discovery source feeds, curated from the ChainGPT AER360 spec (2026-08-11).
-- These are plain http(s) sources — discover/route.ts's existing else-branch
-- already crawls any http(s) source_url_or_query via readUrl()+extractCompanies(),
-- regardless of the source_type label, so no code change was needed, just data.
-- Skipped from ChainGPT's list: Crunchbase/Dealroom/Tracxn (require login, won't
-- crawl via Jina), PR Newswire/GlobeNewswire/BusinessWire (generic wire homepages,
-- not useful without a specific query — better served by the existing Exa-search
-- sources already in the table).
insert into sources (source_name, source_type, source_url_or_query, target_industry_category, target_customer_category, frequency, quality_rating, status, notes) values
  ('TechCrunch AI Agents', 'news_source', 'https://techcrunch.com/tag/ai-agents/', 'AI agent / agentic commerce company', 'AER360 Custody / Key-Governance Customer', 'daily', 'excellent', 'active', 'ChainGPT-recommended feed — recent coverage has surfaced exactly the AER360 ICP (AI agents given financial authority).'),
  ('TechCrunch Fintech', 'news_source', 'https://techcrunch.com/category/fintech/', 'Fintech', 'AER360 Custody / Key-Governance Customer', 'daily', 'good', 'active', 'ChainGPT-recommended feed.'),
  ('TechCrunch Payments', 'news_source', 'https://techcrunch.com/tag/payments/', 'Fintech', 'Agentic Payments Customer', 'daily', 'good', 'active', 'ChainGPT-recommended feed.'),
  ('The Block', 'news_source', 'https://www.theblock.co/', 'Custody / MPC wallet provider', 'AER360 Custody / Key-Governance Customer', 'daily', 'excellent', 'active', 'ChainGPT-recommended feed — crypto/agent-economy coverage (agent wallets, custody launches).'),
  ('CoinDesk', 'news_source', 'https://www.coindesk.com/', 'Custody / MPC wallet provider', 'AER360 Custody / Key-Governance Customer', 'daily', 'good', 'active', 'ChainGPT-recommended feed.'),
  ('Blockworks', 'news_source', 'https://blockworks.co/', 'Custody / MPC wallet provider', 'AER360 Custody / Key-Governance Customer', 'daily', 'good', 'active', 'ChainGPT-recommended feed.'),
  ('Decrypt', 'news_source', 'https://decrypt.co/', 'Custody / MPC wallet provider', 'AER360 Custody / Key-Governance Customer', 'weekly', 'average', 'active', 'ChainGPT-recommended feed.'),
  ('Reuters Technology', 'news_source', 'https://www.reuters.com/technology/', 'AI-native SaaS selling to enterprise', 'AER360 Custody / Key-Governance Customer', 'weekly', 'good', 'active', 'ChainGPT-recommended feed — enterprise-grade signal (banks/institutions deploying financial agents).'),
  ('Finextra', 'news_source', 'https://www.finextra.com/', 'Fintech', 'AER360 Custody / Key-Governance Customer', 'weekly', 'good', 'active', 'ChainGPT-recommended feed — fintech/payments trade press.');
