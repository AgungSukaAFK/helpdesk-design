-- Rename departemen to divisi in permintaan table
alter table public.permintaan rename column departemen to divisi;

-- Rename departemen to divisi in daily_activities table
alter table public.daily_activities rename column departemen to divisi;

-- Rename department to divisi in user_profiles table
alter table public.user_profiles rename column department to divisi;

-- Rename department to divisi in users table
alter table public.users rename column department to divisi;

-- Drop old indexes
drop index if exists user_profiles_department_idx;
drop index if exists users_department_idx;

-- Create new indexes
create index if not exists user_profiles_divisi_idx on public.user_profiles (divisi);
create index if not exists users_divisi_idx on public.users (divisi);

-- Re-create the sync_permintaan_daily_activity trigger function to use divisi
create or replace function public.sync_permintaan_daily_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_remarks text;
  activity_status text;
begin
  activity_remarks := concat_ws(
    E'\n',
    'Project: ' || coalesce(new.project, '-'),
    'Divisi: ' || coalesce(new.divisi, '-'),
    'Due date: ' || coalesce(new.due_date::text, '-')
  );

  activity_status := case new.status
    when 'TO DO' then '⏳ Waiting (Menunggu)'
    when 'PROGRESS' then '⚡ In Progress (Dalam Proses)'
    when 'REVISION' then '🔄 Revisi (Revisi Pengerjaan)'
    when 'REVIEW' then '⏸️ Pending (Tertunda)'
    when 'DONE' then '✅ Done (Selesai)'
    else '⏳ Waiting (Menunggu)'
  end;

  update public.daily_activities
  set user_id = new.requester,
      activity_date = new.created_at::date,
      name = 'Permintaan Desain',
      task_description = new.judul,
      title = new.judul,
      description = new.deskripsi,
      status = activity_status,
      remarks = activity_remarks,
      request_title = new.judul,
      request_description = new.deskripsi,
      project = new.project,
      divisi = new.divisi,
      due_date = new.due_date,
      requester = new.requester,
      admin = new.admin,
      files = new.files,
      updated_at = now()
  where request_id = new.id;

  if not found then
    insert into public.daily_activities (
      request_id, user_id, activity_date, name, task_description, title,
      description, status, remarks, request_title, request_description,
      project, divisi, due_date, requester, admin, files
    ) values (
      new.id, new.requester, new.created_at::date, 'Permintaan Desain',
      new.judul, new.judul, new.deskripsi, activity_status, activity_remarks,
      new.judul, new.deskripsi, new.project, new.divisi, new.due_date,
      new.requester, new.admin, new.files
    );
  end if;

  return new;
end;
$$;

drop trigger if exists permintaan_sync_daily_activity on public.permintaan;
create trigger permintaan_sync_daily_activity
after insert or update of requester, created_at, judul, deskripsi, project,
divisi, due_date, status, admin, files
on public.permintaan
for each row execute function public.sync_permintaan_daily_activity();

notify pgrst, 'reload schema';
