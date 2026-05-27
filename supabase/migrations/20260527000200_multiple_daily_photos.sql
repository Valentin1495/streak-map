alter table public.photos
  add column if not exists is_representative boolean not null default false;

drop index if exists public.photos_one_per_user_day;

update public.photos
set is_representative = false;

update public.photos
set is_representative = true
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, streak_date
        order by taken_at desc, id desc
      ) as row_num
    from public.photos
  ) ranked
  where ranked.row_num = 1
);

create unique index if not exists photos_one_representative_per_user_day
  on public.photos (user_id, streak_date)
  where is_representative = true;

create index if not exists photos_user_day_taken_at
  on public.photos (user_id, streak_date, taken_at desc);

create or replace function public.enforce_daily_photo_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.photos
    where user_id = new.user_id
      and streak_date = new.streak_date
  ) >= 3 then
    raise exception 'daily photo limit exceeded';
  end if;

  return new;
end;
$$;

drop trigger if exists photos_daily_limit on public.photos;

create trigger photos_daily_limit
  before insert on public.photos
  for each row
  execute function public.enforce_daily_photo_limit();
