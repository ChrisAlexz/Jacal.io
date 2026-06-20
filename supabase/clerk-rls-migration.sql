-- ============================================================================
-- Jacal — Clerk ↔ Supabase RLS migration
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- PREREQUISITE (do this FIRST in the dashboard):
--   Authentication → Sign In / Providers → Add provider → Clerk
--   (paste your Clerk domain: diverse-dragon-65.clerk.accounts.dev)
--   This makes auth.jwt()->>'sub' resolve to the Clerk user id, and adds the
--   "authenticated" role claim to Clerk session tokens.
--
-- WHAT THIS DOES:
--   • Enables Row Level Security on all 5 owned tables
--   • Wipes existing rows (old Supabase-auth UUID owners can't map to Clerk
--     IDs — you confirmed this is fine)
--   • Converts user_id from uuid → text, defaulting to the Clerk user id
--   • Adds owner-only RLS policies keyed on auth.jwt()->>'sub'
--
-- Tables: classes, flashcard_sets, flashcard_cards, daily_review_stats,
--         study_sessions
-- ============================================================================

begin;

-- 1) Enable RLS, drop any pre-existing policies, and drop any FK on user_id
--    that points at auth.users (Clerk users don't live there).
do $$
declare
  t        text;
  tbls     text[] := array['classes','flashcard_sets','flashcard_cards','daily_review_stats','study_sessions'];
  pol      record;
  con      record;
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security', t);

    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    for con in
      select c.conname
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = format('public.%I', t)::regclass
        and c.contype = 'f'
        and a.attname = 'user_id'
    loop
      execute format('alter table public.%I drop constraint %I', t, con.conname);
    end loop;
  end loop;
end $$;

-- 2) Wipe existing data (old UUID owners are unusable under Clerk).
truncate table
  public.flashcard_cards,
  public.flashcard_sets,
  public.classes,
  public.daily_review_stats,
  public.study_sessions
cascade;

-- 3) Convert user_id → text, default to the Clerk user id, and add policies.
do $$
declare
  t    text;
  tbls text[] := array['classes','flashcard_sets','flashcard_cards','daily_review_stats','study_sessions'];
begin
  foreach t in array tbls loop
    execute format('alter table public.%I alter column user_id drop default', t);
    execute format('alter table public.%I alter column user_id type text using user_id::text', t);
    execute format('alter table public.%I alter column user_id set default (auth.jwt()->>''sub'')', t);
    execute format('alter table public.%I alter column user_id set not null', t);

    execute format($p$
      create policy "Owner can read"   on public.%1$I for select to authenticated
        using ((auth.jwt()->>'sub') = user_id);
    $p$, t);
    execute format($p$
      create policy "Owner can insert" on public.%1$I for insert to authenticated
        with check ((auth.jwt()->>'sub') = user_id);
    $p$, t);
    execute format($p$
      create policy "Owner can update" on public.%1$I for update to authenticated
        using ((auth.jwt()->>'sub') = user_id)
        with check ((auth.jwt()->>'sub') = user_id);
    $p$, t);
    execute format($p$
      create policy "Owner can delete" on public.%1$I for delete to authenticated
        using ((auth.jwt()->>'sub') = user_id);
    $p$, t);
  end loop;
end $$;

commit;

-- ============================================================================
-- Sanity check (run separately after the migration):
--   select tablename, rowsecurity
--   from pg_tables where schemaname='public'
--     and tablename in ('classes','flashcard_sets','flashcard_cards',
--                       'daily_review_stats','study_sessions');
--   -- rowsecurity should be true for all five.
-- ============================================================================

-- ============================================================================
-- Heatmap RPC: accept text Clerk ids and derive the user from the token
-- (was uuid + trusted the client-passed p_user_id while SECURITY DEFINER).
-- ============================================================================
drop function if exists public.increment_daily_review_count(uuid, date, integer, integer, boolean);

create or replace function public.increment_daily_review_count(
  p_user_id         text,                  -- kept for call compatibility; NOT trusted
  p_review_date     date,
  p_reviews_count   integer default 1,
  p_cards_studied   integer default 1,
  p_is_master_again boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id text := auth.jwt()->>'sub';
  master_again_increment integer := case when p_is_master_again then 1 else 0 end;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into daily_review_stats (user_id, review_date, reviews_count, cards_studied, session_count, master_again_count)
  values (v_user_id, p_review_date, p_reviews_count, p_cards_studied, 1, master_again_increment)
  on conflict (user_id, review_date)
  do update set
    reviews_count      = daily_review_stats.reviews_count + p_reviews_count,
    cards_studied      = daily_review_stats.cards_studied + p_cards_studied,
    session_count      = daily_review_stats.session_count + 1,
    master_again_count = daily_review_stats.master_again_count + master_again_increment,
    updated_at         = now();
end;
$function$;
