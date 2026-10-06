-- asin_tracker — per-ASIN manual triage state for the Keepa Product Finder.
-- Owner: KeepaCompanion (see ../../CONTRACTS.md §2).
--
-- One row per ASIN, deliberately filter-agnostic: the whole point of putting
-- this in Postgres rather than extension storage is that a verdict reached
-- under one Product Finder filter is still visible under the next one.

create table if not exists public.asin_tracker (
  asin text primary key,
  status text check (status in ('checked', 'bought', 'near_miss', 'pass')),
  status_at timestamptz,
  last_searched_at timestamptz,
  note text,
  updated_at timestamptz not null default now()
);

comment on table public.asin_tracker is
  'Manual per-ASIN triage state for the Keepa Product Finder columns. Owner: KeepaCompanion.';
comment on column public.asin_tracker.status is
  'checked | bought | near_miss | pass. Null means the ASIN has been seen but not judged.';
comment on column public.asin_tracker.last_searched_at is
  'When this ASIN was last manually researched — stamped on a product-link click or an explicit cell click.';

-- Sorting the tracker by recency is the only non-PK access path the
-- extension needs.
create index if not exists asin_tracker_status_at_idx
  on public.asin_tracker (status_at desc nulls last);

alter table public.asin_tracker enable row level security;

-- Single-user triage data, read and written by one browser extension holding
-- the anon key — the same risk profile the dashboard already accepts for
-- business_snapshots (CONTRACTS.md §3). The status CHECK above is the real
-- guard: anon cannot write a status outside the four sanctioned values.
-- No DELETE grant: clearing a status is an UPDATE to null, never a row drop.
grant select, insert, update on public.asin_tracker to anon;

-- Explicit, because this project has no pg_default_acl entry that supplies
-- one — the omission that broke wholesale_sync_requests live
-- (alchemist-v2 CLAUDE.md, G4 pilot). Nothing server-side writes this table
-- today; the grant is here so the first server-side reader does not have to
-- rediscover that.
grant select, insert, update on public.asin_tracker to service_role;

drop policy if exists asin_tracker_anon_read on public.asin_tracker;
create policy asin_tracker_anon_read
  on public.asin_tracker for select to anon
  using (true);

drop policy if exists asin_tracker_anon_insert on public.asin_tracker;
create policy asin_tracker_anon_insert
  on public.asin_tracker for insert to anon
  with check (true);

drop policy if exists asin_tracker_anon_update on public.asin_tracker;
create policy asin_tracker_anon_update
  on public.asin_tracker for update to anon
  using (true)
  with check (true);
