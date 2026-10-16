-- Permintaan berstatus REVIEW (hasil dikirim, menunggu klien) sebelumnya
-- tersinkron ke Daily Activity sebagai "⏸️ Pending (Tertunda)", sehingga terlihat
-- seperti pekerjaan tertunda. Tambah status Daily Activity khusus untuk review.

alter table public.daily_activities
  drop constraint if exists daily_activities_status_check;

alter table public.daily_activities
  add constraint daily_activities_status_check
  check (status in (
    '⏳ Waiting (Menunggu)',
    '⚡ In Progress (Dalam Proses)',
    '🔄 Revisi (Revisi Pengerjaan)',
    '👀 Review (Ditinjau Klien)',
    '⏸️ Pending (Tertunda)',
    '✅ Done (Selesai)'
  ));

create or replace function public.sync_permintaan_daily_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_remarks text;
  activity_status text;
  designer_name text;
begin
  activity_remarks := concat_ws(
    E'\n',
    'Project: ' || coalesce(new.project, '-'),
    'Departemen: ' || coalesce(new.departemen, '-'),
    'Due date: ' || coalesce(new.due_date::text, '-')
  );

  activity_status := case new.status
    when 'TO DO' then '⏳ Waiting (Menunggu)'
    when 'PROGRESS' then '⚡ In Progress (Dalam Proses)'
    when 'REVISION' then '🔄 Revisi (Revisi Pengerjaan)'
    when 'REVIEW' then '👀 Review (Ditinjau Klien)'
    when 'DONE' then '✅ Done (Selesai)'
    else '⏳ Waiting (Menunggu)'
  end;

  select nullif(trim(coalesce(p.name, p.email)), '')
  into designer_name
  from public.user_profiles p
  where p.id = new.admin;

  -- Kolom name NOT NULL; permintaan baru belum punya desainer.
  designer_name := coalesce(designer_name, '');

  update public.daily_activities
  set user_id = new.requester,
      activity_date = new.created_at::date,
      -- Pertahankan nama yang sudah diedit manual (mis. beberapa desainer),
      -- kecuali desainer berubah atau nama masih kosong/label lama.
      name = case
        when tg_op = 'UPDATE' and new.admin is not distinct from old.admin
          and coalesce(name, '') not in ('', 'Permintaan Desain')
          then name
        else designer_name
      end,
      task_description = new.judul,
      title = new.judul,
      description = new.deskripsi,
      status = activity_status,
      remarks = activity_remarks,
      request_title = new.judul,
      request_description = new.deskripsi,
      project = new.project,
      departemen = new.departemen,
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
      project, departemen, due_date, requester, admin, files
    ) values (
      new.id, new.requester, new.created_at::date, designer_name,
      new.judul, new.judul, new.deskripsi, activity_status, activity_remarks,
      new.judul, new.deskripsi, new.project, new.departemen, new.due_date,
      new.requester, new.admin, new.files
    );
  end if;

  return new;
end;
$$;


-- Perbaiki baris yang sudah terlanjur tercatat Pending karena tiketnya sedang REVIEW.
update public.daily_activities d
set status = '👀 Review (Ditinjau Klien)',
    updated_at = now()
from public.permintaan p
where d.request_id = p.id
  and p.status = 'REVIEW'
  and d.status = '⏸️ Pending (Tertunda)';

notify pgrst, 'reload schema';
