-- Dokumen Form Desain: lembar pengesahan hasil desain (title block seperti
-- "referensi dokumen.jpeg") yang ditandatangani secara digital di aplikasi.
--
-- - Satu dokumen selalu terkait ke satu permintaan desain dan satu file hasil
--   (gambar) dari lampiran permintaan tersebut.
-- - Penanda tangan ditentukan saat dokumen dibuat: 1 designer, lalu sejumlah
--   Acknowledge dan Approval. Masing-masing tanda tangan sendiri (upload gambar
--   atau digambar di web), urutannya bebas.
-- - Semua akses lewat API (service role); tabel tidak dibuka untuk client.

create table if not exists public.dokumen_desain (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  permintaan_id   uuid not null references public.permintaan(id) on delete restrict,
  -- Salinan {name, url} file hasil yang dipilih dari permintaan.files
  hasil_file      jsonb not null,
  no_dokumen      text not null,
  no_dokumen_sub  text,
  project_design  text not null,
  tipe_design     text not null,
  deskripsi       text not null,
  status          text not null default 'MENUNGGU'
                  check (status in ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  revisi          integer not null default 0,
  created_by      uuid not null references public.user_profiles(id) on delete restrict,
  disetujui_at    timestamptz
);

create index if not exists dokumen_desain_permintaan_idx on public.dokumen_desain (permintaan_id);
create index if not exists dokumen_desain_created_by_idx on public.dokumen_desain (created_by);
create index if not exists dokumen_desain_created_at_idx on public.dokumen_desain (created_at desc);

drop trigger if exists dokumen_desain_set_updated_at on public.dokumen_desain;
create trigger dokumen_desain_set_updated_at
  before update on public.dokumen_desain
  for each row execute function public.set_updated_at();

create table if not exists public.dokumen_desain_ttd (
  id           uuid primary key default gen_random_uuid(),
  dokumen_id   uuid not null references public.dokumen_desain(id) on delete cascade,
  user_id      uuid not null references public.user_profiles(id) on delete restrict,
  peran        text not null check (peran in ('designer', 'acknowledge', 'approval')),
  urutan       integer not null default 0,
  -- Keterangan di bawah nama: jabatan (acknowledge) atau departemen (approval)
  jabatan      text,
  status       text not null default 'MENUNGGU'
               check (status in ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  ttd_path     text,
  signed_at    timestamptz,
  catatan      text,
  unique (dokumen_id, user_id, peran)
);

create index if not exists dokumen_desain_ttd_dokumen_idx on public.dokumen_desain_ttd (dokumen_id, urutan);
create index if not exists dokumen_desain_ttd_user_idx on public.dokumen_desain_ttd (user_id, status);

create table if not exists public.dokumen_desain_riwayat (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  dokumen_id  uuid not null references public.dokumen_desain(id) on delete cascade,
  user_id     uuid references public.user_profiles(id) on delete set null,
  aksi        text not null,
  catatan     text
);

create index if not exists dokumen_desain_riwayat_dokumen_idx
  on public.dokumen_desain_riwayat (dokumen_id, created_at);

-- RLS aktif tanpa policy: client tidak bisa baca/tulis langsung,
-- semua lewat /api/dokumen-desain (service role + cek hak akses).
alter table public.dokumen_desain enable row level security;
alter table public.dokumen_desain_ttd enable row level security;
alter table public.dokumen_desain_riwayat enable row level security;

-- Tanda tangan tersimpan per user, bisa dipakai ulang saat menandatangani.
alter table public.user_profiles
  add column if not exists ttd_path text;

-- Bucket privat untuk gambar tanda tangan; dibaca lewat signed URL dari API.
insert into storage.buckets (id, name, public)
values ('dokumen-desain', 'dokumen-desain', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
