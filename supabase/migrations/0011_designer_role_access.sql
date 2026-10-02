alter table public.users
  drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('user', 'admin', 'designer'));

alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check check (role in ('user', 'admin', 'designer'));

drop policy if exists "permintaan users read own" on public.permintaan;
create policy "permintaan users read own"
  on public.permintaan for select to authenticated
  using (
    requester = auth.uid()
    or admin = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role in ('admin', 'designer')
    )
  );

drop policy if exists "permintaan users update related" on public.permintaan;
create policy "permintaan users update related"
  on public.permintaan for update to authenticated
  using (
    requester = auth.uid()
    or admin = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
    or (
      admin is null
      and exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role = 'designer'
      )
    )
  )
  with check (
    requester = auth.uid()
    or admin = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

drop policy if exists "articles designer author read" on public.articles;
create policy "articles designer author read"
  on public.articles for select to authenticated
  using (
    author = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'designer'
    )
  );

drop policy if exists "articles designer author insert" on public.articles;
create policy "articles designer author insert"
  on public.articles for insert to authenticated
  with check (
    author = auth.uid()
    and status = 'draft'
    and not featured
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'designer'
    )
  );

drop policy if exists "articles designer author update" on public.articles;
create policy "articles designer author update"
  on public.articles for update to authenticated
  using (
    author = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'designer'
    )
  )
  with check (
    author = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'designer'
    )
  );

drop policy if exists "articles designer author delete" on public.articles;
create policy "articles designer author delete"
  on public.articles for delete to authenticated
  using (
    author = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'designer'
    )
  );

drop policy if exists "komentar designers related read" on public.komentar;
create policy "komentar designers related read"
  on public.komentar for select to authenticated
  using (
    exists (
      select 1 from public.permintaan p
      where p.id = permintaan_id
        and (p.admin is null or p.admin = auth.uid())
        and exists (
          select 1 from public.user_profiles up
          where up.id = auth.uid() and up.role = 'designer'
        )
    )
  );

drop policy if exists "komentar designers related create" on public.komentar;
create policy "komentar designers related create"
  on public.komentar for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.permintaan p
      where p.id = permintaan_id
        and (p.admin is null or p.admin = auth.uid())
        and exists (
          select 1 from public.user_profiles up
          where up.id = auth.uid() and up.role = 'designer'
        )
    )
  );

create or replace function public.guard_designer_article_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.author and exists (
    select 1 from public.users u
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

drop trigger if exists articles_guard_designer_fields on public.articles;
create trigger articles_guard_designer_fields
  before update on public.articles
  for each row execute function public.guard_designer_article_fields();

drop policy if exists "articles bucket admin write" on storage.objects;
drop policy if exists "articles bucket role write" on storage.objects;
create policy "articles bucket role write"
  on storage.objects for all
  using (
    bucket_id = 'articles'
    and (
      exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.role = 'admin'
      )
      or (
        (storage.foldername(name))[1] = 'authors'
        and (storage.foldername(name))[2] = auth.uid()::text
        and exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.role = 'designer'
        )
      )
    )
  )
  with check (
    bucket_id = 'articles'
    and (
      exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.role = 'admin'
      )
      or (
        (storage.foldername(name))[1] = 'authors'
        and (storage.foldername(name))[2] = auth.uid()::text
        and exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.role = 'designer'
        )
      )
    )
  );