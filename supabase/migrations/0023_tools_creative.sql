-- Tools Creative: data perencanaan & evaluasi tim design (dulu dikelola di file
-- "Tools Creative <Bulan>.xlsx").
--   content_plan       : sheet "Design Month"  (jadwal konten/desain per bulan)
--   target_project     : sheet "Todo List"     (target jumlah vs realisasi project)
--   evaluasi_designer  : sheet "Evaluasi"      (skor 1-5 per project)
--   wla_item           : sheet WLA per orang   (kertas kerja analisis beban kerja)
-- Baca: semua user login. Tulis: admin.
-- Jalankan setelah 0022_push_subscriptions.sql.

create table if not exists public.content_plan (
  id           uuid primary key default gen_random_uuid(),
  jenis        text,
  judul        text not null,
  tgl_mulai    date,
  tgl_selesai  date,
  due_date     date,
  tgl_publish  date,
  status       text,
  designer     text,
  remarks      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists content_plan_tgl_mulai_idx on public.content_plan (tgl_mulai desc);

create table if not exists public.target_project (
  id           uuid primary key default gen_random_uuid(),
  nama         text not null,
  aktivitas    text not null,
  rencana      integer not null default 0,
  realisasi    integer not null default 0,
  tgl_mulai    date,
  deadline     date,
  status       text,
  remarks      text,
  link         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.evaluasi_designer (
  id           uuid primary key default gen_random_uuid(),
  periode      text not null check (periode ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  designer     text not null,
  project      text not null,
  kreativitas  smallint not null check (kreativitas between 1 and 5),
  brief        smallint not null check (brief between 1 and 5),
  deadline     smallint not null check (deadline between 1 and 5),
  kualitas     smallint not null check (kualitas between 1 and 5),
  komunikasi   smallint not null check (komunikasi between 1 and 5),
  revisi       smallint not null check (revisi between 1 and 5),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists evaluasi_designer_periode_idx on public.evaluasi_designer (periode);

create table if not exists public.wla_item (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null,
  posisi          text,
  divisi          text,
  no_urut         integer,
  tanggung_jawab  text,
  aktivitas       text not null,
  keluaran        text,
  pelaksanaan     text,
  frekuensi       numeric not null default 1,
  satuan          text,
  jumlah_keluaran numeric not null default 0,
  durasi_menit    numeric not null default 0,
  catatan         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists wla_item_nama_idx on public.wla_item (nama, no_urut);

do $$
declare t text;
begin
  foreach t in array array['content_plan', 'target_project', 'evaluasi_designer', 'wla_item'] loop
    execute format('drop trigger if exists %1$s_set_updated_at on public.%1$s', t);
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at()', t);

    execute format('alter table public.%s enable row level security', t);

    execute format('drop policy if exists "%1$s authenticated read" on public.%1$s', t);
    execute format(
      'create policy "%1$s authenticated read" on public.%1$s
         for select to authenticated using (true)', t);

    execute format('drop policy if exists "%1$s admin write" on public.%1$s', t);
    execute format(
      'create policy "%1$s admin write" on public.%1$s
         for all to authenticated
         using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = ''admin''))
         with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = ''admin''))', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
