alter table public.protection_tickets
  add column if not exists source text not null default 'milestone',
  add column if not exists earned_date date;

update public.protection_tickets
set source = 'milestone'
where source is null;

create unique index if not exists protection_tickets_rewarded_ad_daily
  on public.protection_tickets (user_id, earned_date)
  where source = 'rewarded_ad';
