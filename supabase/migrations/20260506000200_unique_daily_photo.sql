-- Keep one representative photo per user per streak date.
-- If historical duplicates exist, keep the latest row for each day.

delete from public.photos
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
  where ranked.row_num > 1
);

create unique index if not exists photos_one_per_user_day
  on public.photos (user_id, streak_date);
