alter table public.user_profiles
  add column if not exists nrp text,
  add column if not exists perusahaan text,
  add column if not exists lokasi text,
  add column if not exists avatar_url text;

drop policy if exists "user profiles update own" on public.user_profiles;
create policy "user profiles update own"
  on public.user_profiles for update to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.user_profiles admin_profile
      where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
    )
  )
  with check (
    id = auth.uid()
    or exists (
      select 1 from public.user_profiles admin_profile
      where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
    )
  );

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.role is distinct from old.role
     and not exists (
       select 1 from public.user_profiles admin_profile
       where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
     ) then
    raise exception 'Only an admin can change a user role';
  end if;
  return new;
end;
$$;

drop trigger if exists user_profiles_prevent_role_escalation on public.user_profiles;
create trigger user_profiles_prevent_role_escalation
  before update of role on public.user_profiles
  for each row execute function public.prevent_profile_role_escalation();