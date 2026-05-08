-- streak_milestones: 마일스톤 달성 기록 (3, 7, 14, 30, 100일)
create table if not exists public.streak_milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  milestone   int not null,
  achieved_at timestamptz not null,
  badge_shown boolean not null default false
);

alter table public.streak_milestones enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'streak_milestones' and policyname = 'milestones_anon_read'
  ) then
    create policy "milestones_anon_read"
      on public.streak_milestones for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'streak_milestones' and policyname = 'milestones_anon_insert'
  ) then
    create policy "milestones_anon_insert"
      on public.streak_milestones for insert to anon
      with check (user_id is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'streak_milestones' and policyname = 'milestones_anon_update'
  ) then
    create policy "milestones_anon_update"
      on public.streak_milestones for update to anon using (true);
  end if;
end $$;

-- protection_tickets: 기록 보호권 (지급/사용 추적)
create table if not exists public.protection_tickets (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  earned_at      timestamptz not null,
  used_at        timestamptz,
  used_for_date  date
);

alter table public.protection_tickets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'protection_tickets' and policyname = 'tickets_anon_read'
  ) then
    create policy "tickets_anon_read"
      on public.protection_tickets for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'protection_tickets' and policyname = 'tickets_anon_insert'
  ) then
    create policy "tickets_anon_insert"
      on public.protection_tickets for insert to anon
      with check (user_id is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'protection_tickets' and policyname = 'tickets_anon_update'
  ) then
    create policy "tickets_anon_update"
      on public.protection_tickets for update to anon using (true);
  end if;
end $$;
