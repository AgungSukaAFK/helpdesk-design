-- QCC tim Creative: laporan per rentang tanggal yang dipilih user, dan kode penyebab tiket.
--   qcc_kode_penyebab : master penyebab revisi/keterlambatan (faktor 4M1E)
--   qcc_laporan       : satu laporan = satu rentang tanggal (+ rentang pembanding opsional).
--                       Angka selalu dihitung dari data sistem pada rentang itu; yang
--                       disimpan hanya isian tim, pilihan slide, dan snapshot saat final.
-- Baca: admin & designer. Tulis: lewat API (service role), sama seperti permintaan_riwayat.
-- Jalankan setelah 0030_admin_edit_permintaan.sql.

create table if not exists public.qcc_kode_penyebab (
  kode        text primary key,
  label       text not null,
  faktor      text not null check (faktor in ('Man', 'Machine', 'Material', 'Method', 'Environment')),
  berlaku     text not null default 'semua' check (berlaku in ('revisi', 'terlambat', 'semua')),
  aktif       boolean not null default true,
  urutan      integer not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.qcc_kode_penyebab (kode, label, faktor, berlaku, urutan) values
  ('BRIEF_KURANG',    'Brief atau materi dari pemohon kurang lengkap', 'Material',    'semua',     10),
  ('MATERI_TERLAMBAT','Materi atau aset terlambat diterima',           'Material',    'terlambat', 20),
  ('ACC_MENUNGGU',    'Menunggu persetujuan atau tanda tangan',        'Method',      'terlambat', 30),
  ('PERUBAHAN_PEMOHON','Pemohon mengubah isi atau keinginan',          'Method',      'revisi',    40),
  ('SALAH_KONTEN',    'Kesalahan isi, ejaan, atau data pada desain',   'Man',         'revisi',    50),
  ('STANDAR_DESAIN',  'Tidak sesuai standar atau identitas desain',    'Method',      'revisi',    60),
  ('ANTREAN_PENUH',   'Antrean atau beban kerja tim penuh',            'Man',         'terlambat', 70),
  ('ALAT_KENDALA',    'Kendala perangkat atau software',               'Machine',     'semua',     80),
  ('LIBUR_DI_LUAR_JAM','Masuk di luar jam kerja atau hari libur',      'Environment', 'terlambat', 90),
  ('LAINNYA',         'Lainnya (jelaskan pada catatan)',               'Method',      'semua',     100)
on conflict (kode) do nothing;

-- Kode dibawa lewat kolom permintaan, sama seperti last_status_note, lalu disalin
-- trigger ke riwayat. Satu tiket bisa punya penyebab berbeda di tiap revisi.
-- Route aksi harus selalu mengirim kolom ini (null jika kosong), seperti
-- last_status_note, supaya kode yang sama di revisi berikutnya tetap tercatat.
alter table public.permintaan
  add column if not exists last_status_kode text references public.qcc_kode_penyebab(kode);

alter table public.permintaan_riwayat
  add column if not exists kode_penyebab text references public.qcc_kode_penyebab(kode);

create index if not exists permintaan_riwayat_kode_idx
  on public.permintaan_riwayat (kode_penyebab)
  where kode_penyebab is not null;

create or replace function public.permintaan_log_riwayat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.permintaan_riwayat (permintaan_id, created_at, status_from, status_to, changed_by, catatan, kode_penyebab)
    values (new.id, new.created_at, null, new.status, coalesce(new.updated_by, new.requester), new.last_status_note, new.last_status_kode);
  elsif new.status is distinct from old.status then
    insert into public.permintaan_riwayat (permintaan_id, status_from, status_to, changed_by, catatan, kode_penyebab)
    values (new.id, old.status, new.status, new.updated_by, new.last_status_note,
            -- Kode lama tidak boleh menempel pada perubahan status berikutnya.
            case when new.last_status_kode is distinct from old.last_status_kode then new.last_status_kode end);
  end if;
  return null;
end;
$$;

create table if not exists public.qcc_laporan (
  id               uuid primary key default gen_random_uuid(),
  judul            text not null,
  periode_mulai    date not null,
  periode_selesai  date not null,
  banding_mulai    date,
  banding_selesai  date,
  sumber           jsonb not null default '{}'::jsonb,   -- sumber yang dimatikan, mis. { "attendance": false }
  isian            jsonb not null default '{}'::jsonb,   -- isian tim per langkah 1-8, semuanya opsional
  slide            jsonb not null default '[]'::jsonb,   -- [{ "id": "pareto", "aktif": true }]
  status           text not null default 'draft' check (status in ('draft', 'final')),
  snapshot         jsonb,                                -- angka yang dibekukan saat final
  versi_rumus      integer not null default 1,
  finalized_at     timestamptz,
  created_by       uuid references public.user_profiles(id) on delete set null,
  updated_by       uuid references public.user_profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (periode_selesai >= periode_mulai),
  check ((banding_mulai is null) = (banding_selesai is null)),
  check (banding_selesai is null or banding_selesai >= banding_mulai),
  -- Laporan final harus punya angka yang dibekukan.
  check (status <> 'final' or (snapshot is not null and finalized_at is not null))
);

create index if not exists qcc_laporan_periode_idx
  on public.qcc_laporan (periode_mulai desc, periode_selesai desc);

drop trigger if exists qcc_laporan_set_updated_at on public.qcc_laporan;
create trigger qcc_laporan_set_updated_at
  before update on public.qcc_laporan
  for each row execute function public.set_updated_at();

alter table public.qcc_kode_penyebab enable row level security;
alter table public.qcc_laporan enable row level security;

-- Form revisi dipakai juga oleh user pemohon, jadi daftar kode terbuka untuk semua yang login.
drop policy if exists "qcc kode penyebab read" on public.qcc_kode_penyebab;
create policy "qcc kode penyebab read"
  on public.qcc_kode_penyebab for select to authenticated
  using (true);

drop policy if exists "qcc laporan staff read" on public.qcc_laporan;
create policy "qcc laporan staff read"
  on public.qcc_laporan for select to authenticated
  using (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role in ('admin', 'designer')
  ));

notify pgrst, 'reload schema';
