create table if not exists public.daily_photo_slot_rewards (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  reward_date date not null,
  rewarded_at timestamptz not null,
  source      text not null default 'rewarded_ad'
);

alter table public.daily_photo_slot_rewards enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_photo_slot_rewards' and policyname = 'daily_photo_slot_rewards_anon_read'
  ) then
    create policy "daily_photo_slot_rewards_anon_read"
      on public.daily_photo_slot_rewards for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_photo_slot_rewards' and policyname = 'daily_photo_slot_rewards_anon_insert'
  ) then
    create policy "daily_photo_slot_rewards_anon_insert"
      on public.daily_photo_slot_rewards for insert to anon
      with check (user_id is not null);
  end if;
end $$;

create unique index if not exists daily_photo_slot_rewards_user_date
  on public.daily_photo_slot_rewards (user_id, reward_date);

create or replace function public.enforce_daily_photo_limit()
returns trigger
language plpgsql
as $$
declare
  daily_limit int := 3;
begin
  if exists (
    select 1
    from public.daily_photo_slot_rewards
    where user_id = new.user_id
      and reward_date = new.streak_date
  ) then
    daily_limit := 4;
  end if;

  if (
    select count(*)
    from public.photos
    where user_id = new.user_id
      and streak_date = new.streak_date
  ) >= daily_limit then
    raise exception 'daily photo limit exceeded';
  end if;

  return new;
end;
$$;
