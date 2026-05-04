-- Streak Map uses Toss getAnonymousKey() as the app-level user id.
-- Supabase receives these requests with the anon role, so storage/table RLS
-- must explicitly allow the client operations used by the app.

insert into storage.buckets (id, name, public)
values ('streak-photos', 'streak-photos', true)
on conflict (id) do update
set public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'streak_photos_public_read'
  ) then
    create policy "streak_photos_public_read"
      on storage.objects
      for select
      to public
      using (bucket_id = 'streak-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'streak_photos_anon_upload'
  ) then
    create policy "streak_photos_anon_upload"
      on storage.objects
      for insert
      to anon
      with check (bucket_id = 'streak-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'streak_photos_anon_delete'
  ) then
    create policy "streak_photos_anon_delete"
      on storage.objects
      for delete
      to anon
      using (bucket_id = 'streak-photos');
  end if;
end $$;

alter table if exists public.photos enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'photos_anon_read'
  ) then
    create policy "photos_anon_read"
      on public.photos
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'photos_anon_insert'
  ) then
    create policy "photos_anon_insert"
      on public.photos
      for insert
      to anon
      with check (
        user_id is not null
        and storage_path like user_id || '/%'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'photos_anon_delete'
  ) then
    create policy "photos_anon_delete"
      on public.photos
      for delete
      to anon
      using (true);
  end if;
end $$;
