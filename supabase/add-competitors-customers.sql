-- Competitors & Customers section: for each Kima product, track the
-- competitors that own that space and the customers of those competitors,
-- so BD can reach out to accounts that may be unhappy with their current
-- (competing) vendor. Run this once in the Supabase SQL editor.

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null check (product_slug in ('agent', 'aerseal', 'aerpolice', 'aer360')),
  name text not null,
  website text,
  weakness text,        -- what they get wrong / where they're vulnerable
  our_edge text,         -- our pitch against them
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_slug, name)
);

create table if not exists competitor_customers (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  company_name text not null,
  website text,
  region text,
  contact_name text,
  contact_title text,
  contact_email text,
  contact_linkedin text,
  pain_point text,        -- why they might be unhappy with the competitor
  source_url text,        -- evidence for the relationship/pain point
  status text not null default 'not_contacted' check (status in ('not_contacted', 'researching', 'contacted', 'replied', 'in_pipeline', 'not_a_fit')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competitor_id, company_name)
);

create index if not exists idx_competitor_customers_competitor_id on competitor_customers(competitor_id);
create index if not exists idx_competitors_product_slug on competitors(product_slug);

alter table competitors enable row level security;
alter table competitor_customers enable row level security;

drop policy if exists "anon_full_access_competitors" on competitors;
drop policy if exists "anon_full_access_competitor_customers" on competitor_customers;

create policy "anon_full_access_competitors" on competitors for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_competitor_customers" on competitor_customers for all to anon, authenticated using (true) with check (true);
