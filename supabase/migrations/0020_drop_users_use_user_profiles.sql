-- Satukan public.users ke public.user_profiles. user_profiles adalah superset
-- kolom users, jadi semua referensi ke users dipindah lalu tabel users dihapus.

-- 1. Pastikan setiap baris users punya pasangan di user_profiles
insert into public.user_profiles (id, email, name, role, departemen, created_at, updated_at)
select u.id, u.email, u.name, u.role, u.departemen, u.created_at, u.updated_at
from public.users u
on conflict (id) do update set
  name = coalesce(public.user_profiles.name, excluded.name),
  departemen = coalesce(public.user_profiles.departemen, excluded.departemen);

-- 2. FK author artikel
alter table public.articles drop constraint if exists articles_author_fkey;
alter table public.articles
  add constraint articles_author_fkey
  foreign key (author) references public.user_profiles (id) on delete set null;

-- 3. Trigger user baru: cukup satu, hanya ke user_profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
drop function if exists public.handle_new_user_profile();

-- 4. Guard field artikel untuk designer
create or replace function public.guard_designer_article_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.author and exists (
    select 1 from public.user_profiles u
    where u.id = auth.uid() and u.role = 'designer'
  ) and (
    new.status is distinct from old.status
    or new.featured is distinct from old.featured
    or new.author is distinct from old.author
  ) then
    raise exception 'Designer tidak dapat mengubah status, featured, atau author artikel';
  end if;
  return new;
end;
$$;

-- 5. Policy artikel
drop policy if exists "articles admin all" on public.articles;
create policy "articles admin all"
  on public.articles for all
  using (
    exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'admin')
  )
  with check (
    exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'admin')
  );

drop policy if exists "articles designer author read" on public.articles;
create policy "articles designer author read"
  on public.articles for select to authenticated
  using (
    author = auth.uid()
    and exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'designer')
  );

drop policy if exists "articles designer author insert" on public.articles;
create policy "articles designer author insert"
  on public.articles for insert to authenticated
  with check (
    author = auth.uid()
    and status = 'draft'
    and not featured
    and exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'designer')
  );

drop policy if exists "articles designer author update" on public.articles;
create policy "articles designer author update"
  on public.articles for update to authenticated
  using (
    author = auth.uid()
    and exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'designer')
  )
  with check (
    author = auth.uid()
    and exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'designer')
  );

drop policy if exists "articles designer author delete" on public.articles;
create policy "articles designer author delete"
  on public.articles for delete to authenticated
  using (
    author = auth.uid()
    and exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'designer')
  );

-- 6. Policy storage bucket articles
drop policy if exists "articles bucket role write" on storage.objects;
create policy "articles bucket role write"
  on storage.objects for all
  using (
    bucket_id = 'articles'
    and (
      exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'admin')
      or (
        (storage.foldername(name))[1] = 'authors'
        and (storage.foldername(name))[2] = auth.uid()::text
        and exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'designer')
      )
    )
  )
  with check (
    bucket_id = 'articles'
    and (
      exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'admin')
      or (
        (storage.foldername(name))[1] = 'authors'
        and (storage.foldername(name))[2] = auth.uid()::text
        and exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.role = 'designer')
      )
    )
  );

-- 7. Hapus tabel users beserta trigger & function khususnya.
-- Tanpa cascade: gagal kalau masih ada objek lain yang bergantung.
drop table public.users;
drop function if exists public.sync_user_profile();
drop function if exists public.prevent_user_role_escalation();
