-- ============================================================
-- MarginSync — Initial Schema + RLS
-- Migration: 0001_initial_schema
-- ============================================================
-- Run with: supabase db push
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLE: organizations
-- Tenant root. Every org-scoped table references this.
-- Also holds billing state driven by Stripe webhooks.
-- ============================================================
create table organizations (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  stripe_customer_id  text        unique,
  plan                text        not null default 'free'
                                    check (plan in ('free', 'pro')),
  subscription_status text        not null default 'inactive',
  pricing_rule        jsonb,
  margin_target_pct   numeric(5,2),
  created_at          timestamptz not null default now()
);

-- ============================================================
-- TABLE: profiles
-- One row per Supabase auth.users entry.
-- Created automatically by the trigger in 0002_auth_trigger.sql.
-- ============================================================
create table profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TABLE: organization_members
-- Membership + role join. Multi-org supported but MVP uses one.
-- ============================================================
create table organization_members (
  organization_id uuid        not null references organizations(id) on delete cascade,
  user_id         uuid        not null references profiles(id)      on delete cascade,
  role            text        not null default 'owner'
                                check (role in ('owner', 'member')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ============================================================
-- TABLE: shopify_connections
-- One store per org for MVP.
-- access_token_encrypted stores the Supabase Vault secret ID —
-- NEVER the raw token plaintext.
-- ============================================================
create table shopify_connections (
  id                     uuid        primary key default gen_random_uuid(),
  organization_id        uuid        not null references organizations(id) on delete cascade,
  shop_domain            text        not null,
  access_token_encrypted text        not null,
  installed_at           timestamptz not null default now(),
  unique (organization_id, shop_domain)
);

-- ============================================================
-- TABLE: sku_mappings
-- Persistent supplier-SKU ↔ Shopify-variant cross-reference.
-- This incremental memory is the product moat:
-- built once per supplier, reused on every subsequent upload.
-- catalog_cache stores: shopify_sku, old_price, old_cost,
-- product_title, variant_title — populated by sync-catalog.
-- ============================================================
create table sku_mappings (
  id                 uuid        primary key default gen_random_uuid(),
  organization_id    uuid        not null references organizations(id) on delete cascade,
  supplier_sku       text        not null,
  shopify_variant_id text        not null,
  shopify_sku        text,
  target_margin_pct  numeric(5,2),
  catalog_cache      jsonb,
  created_at         timestamptz not null default now(),
  unique (organization_id, supplier_sku)
);

-- ============================================================
-- TABLE: reprice_runs
-- One row per uploaded supplier file / repricing job.
-- State machine: pending → parsed → previewed → syncing → completed | failed
-- column_config stores confirmed { skuCol, costCol } header mapping.
-- ============================================================
create table reprice_runs (
  id                 uuid        primary key default gen_random_uuid(),
  organization_id    uuid        not null references organizations(id) on delete cascade,
  created_by         uuid        references profiles(id),
  source_filename    text,
  column_config      jsonb,
  pricing_rule       jsonb       not null default '{}',
  status             text        not null default 'pending'
                                   check (status in (
                                     'pending', 'parsed', 'previewed',
                                     'syncing', 'completed', 'failed'
                                   )),
  items_total        int         default 0,
  items_changed      int         default 0,
  items_below_margin int         default 0,
  error              text,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);

-- ============================================================
-- TABLE: reprice_run_items
-- Per-product audit trail for every reprice run.
-- Powers the diff preview table and the run history drill-down.
-- selected: false = user deselected this row before sync.
-- synced:   true  = price successfully written to Shopify.
-- ============================================================
create table reprice_run_items (
  id                 uuid        primary key default gen_random_uuid(),
  run_id             uuid        not null references reprice_runs(id) on delete cascade,
  organization_id    uuid        not null references organizations(id) on delete cascade,
  supplier_sku       text        not null,
  shopify_variant_id text,
  product_title      text,
  variant_title      text,
  old_cost           numeric(12,2),
  new_cost           numeric(12,2),
  old_price          numeric(12,2),
  new_price          numeric(12,2),
  margin_pct         numeric(5,2),
  flag               text        check (flag in ('ok', 'cost_up', 'below_margin', 'unmatched')),
  selected           boolean     not null default true,
  synced             boolean     not null default false,
  error              text
);

-- ============================================================
-- INDEXES
-- ============================================================
create index on reprice_runs      (organization_id, created_at desc);
create index on reprice_run_items (run_id);
create index on reprice_run_items (organization_id);
create index on sku_mappings      (organization_id, supplier_sku);

-- ============================================================
-- RLS HELPER FUNCTION: auth_org_ids()
-- Returns the set of organization IDs the current user belongs to.
-- Used in every org-scoped RLS policy below.
-- security definer: runs with owner privileges to read
-- organization_members even when RLS is active on that table.
-- ============================================================
create or replace function auth_org_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select organization_id
  from   organization_members
  where  user_id = auth.uid()
$$;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table organizations        enable row level security;
alter table profiles             enable row level security;
alter table organization_members enable row level security;
alter table shopify_connections  enable row level security;
alter table sku_mappings         enable row level security;
alter table reprice_runs         enable row level security;
alter table reprice_run_items    enable row level security;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles: users can only read/write their own row
create policy "profiles_self_read" on profiles
  for select using (id = auth.uid());

create policy "profiles_self_update" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- organizations: members can read their org; only owners update
create policy "orgs_member_read" on organizations
  for select using (id in (select auth_org_ids()));

create policy "orgs_owner_update" on organizations
  for update using (id in (select auth_org_ids()));

-- organization_members: users see their own memberships
create policy "members_self_select" on organization_members
  for select using (user_id = auth.uid());

-- shopify_connections: org-isolated
create policy "shopify_org_select" on shopify_connections
  for select using (organization_id in (select auth_org_ids()));

create policy "shopify_org_insert" on shopify_connections
  for insert with check (organization_id in (select auth_org_ids()));

create policy "shopify_org_delete" on shopify_connections
  for delete using (organization_id in (select auth_org_ids()));

-- sku_mappings: org-isolated, full CRUD
create policy "sku_mappings_org_select" on sku_mappings
  for select using (organization_id in (select auth_org_ids()));

create policy "sku_mappings_org_insert" on sku_mappings
  for insert with check (organization_id in (select auth_org_ids()));

create policy "sku_mappings_org_update" on sku_mappings
  for update using (organization_id in (select auth_org_ids()))
  with check (organization_id in (select auth_org_ids()));

create policy "sku_mappings_org_delete" on sku_mappings
  for delete using (organization_id in (select auth_org_ids()));

-- reprice_runs: org-isolated, full CRUD
create policy "runs_org_select" on reprice_runs
  for select using (organization_id in (select auth_org_ids()));

create policy "runs_org_insert" on reprice_runs
  for insert with check (organization_id in (select auth_org_ids()));

create policy "runs_org_update" on reprice_runs
  for update using (organization_id in (select auth_org_ids()))
  with check (organization_id in (select auth_org_ids()));

-- reprice_run_items: org-isolated, full CRUD
create policy "run_items_org_select" on reprice_run_items
  for select using (organization_id in (select auth_org_ids()));

create policy "run_items_org_insert" on reprice_run_items
  for insert with check (organization_id in (select auth_org_ids()));

create policy "run_items_org_update" on reprice_run_items
  for update using (organization_id in (select auth_org_ids()))
  with check (organization_id in (select auth_org_ids()));
