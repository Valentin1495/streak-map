create table if not exists public.daily_photo_replacements (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  replacement_date date not null,
  replaced_at timestamptz not null default now(),
  source text not null default 'free'
);

alter table public.daily_photo_replacements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_photo_replacements'
      and policyname = 'daily_photo_replacements_anon_read'
  ) then
    create policy "daily_photo_replacements_anon_read"
      on public.daily_photo_replacements for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_photo_replacements'
      and policyname = 'daily_photo_replacements_anon_insert'
  ) then
    create policy "daily_photo_replacements_anon_insert"
      on public.daily_photo_replacements for insert to anon
      with check (user_id is not null);
  end if;
end $$;

create index if not exists daily_photo_replacements_user_date
  on public.daily_photo_replacements (user_id, replacement_date, replaced_at desc);
