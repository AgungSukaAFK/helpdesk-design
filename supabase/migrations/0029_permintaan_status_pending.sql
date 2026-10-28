-- Status PENDING: desainer menunda sementara pengerjaan (mis. ada keperluan lain)
-- lalu melanjutkannya kembali. Waktu aktual pengerjaan dihitung dari
-- permintaan_riwayat, sehingga waktu selama PENDING tidak ikut terhitung.

-- Constraint status bawaan dibuat inline di 0002; cari berdasarkan isinya.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.permintaan'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.permintaan drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.permintaan
  add constraint permintaan_status_check
  check (status in ('TO DO', 'PROGRESS', 'PENDING', 'REVIEW', 'REVISION', 'DONE'));

-- Sama seperti 0021, kecuali: melanjutkan revisi yang ditunda (PENDING → REVISION)
-- bukan pengajuan revisi baru, jadi revision_at & revision_count tidak berubah.
create or replace function public.permintaan_track_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  -- Request langsung dari client (auth.uid() terisi): catat pelaku & guard field
  if auth.uid() is not null then
    new.updated_by := auth.uid();

    if tg_op = 'UPDATE' then
      select exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role = 'admin'
      ) into is_admin;

      if not is_admin and (
        new.status is distinct from old.status
        or new.admin is distinct from old.admin
        or new.requester is distinct from old.requester
        or new.rating is distinct from old.rating
        or new.review is distinct from old.review
        or new.revision_count is distinct from old.revision_count
      ) then
        raise exception 'Perubahan status/PIC/rating hanya dapat dilakukan melalui alur kerja aplikasi';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    -- Catatan hanya berlaku untuk perubahan status yang menyertakannya
    if tg_op = 'UPDATE' and new.last_status_note is not distinct from old.last_status_note then
      new.last_status_note := null;
    end if;

    case new.status
      when 'PROGRESS' then new.progress_at := coalesce(new.progress_at, now());
      when 'REVIEW' then
        new.progress_at := coalesce(new.progress_at, now());
        new.review_at := now();
      when 'REVISION' then
        if tg_op = 'INSERT' or old.status is distinct from 'PENDING' then
          new.revision_at := now();
          new.revision_count := coalesce(new.revision_count, 0) + 1;
        end if;
      when 'DONE' then
        new.done_at := case when tg_op = 'INSERT'
                            then coalesce(new.done_at, new.updated_at, now())
                            else now() end;
      else null;
    end case;

    -- Dibuka kembali dari DONE: waktu selesai lama tidak berlaku lagi
    if tg_op = 'UPDATE' and old.status = 'DONE' and new.status <> 'DONE' then
      new.done_at := null;
    end if;
  end if;

  return new;
end;
$$;

-- Sama seperti 0028, ditambah pemetaan PENDING → "⏸️ Pending (Tertunda)".
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
    when 'PENDING' then '⏸️ Pending (Tertunda)'
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

notify pgrst, 'reload schema';
