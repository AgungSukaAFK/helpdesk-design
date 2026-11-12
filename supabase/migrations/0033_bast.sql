-- BAST (Berita Acara Serah Terima): surat serah terima barang hasil desain
-- (stiker ID card, poster, sticker, dst.) dari tim Design ke satu penerima,
-- mengikuti contoh "BAST GMI IT DESIGN Site BA.pdf".
--
-- - Jenis BAST dinamis (bast_jenis): nama, kode untuk nomor, serta judul,
--   bentuk daftar barang, dan klausul bawaan yang mengisi form otomatis.
-- - Daftar barang bisa berupa daftar biasa (1 kolom) atau tabel bebas kolom;
--   disimpan sebagai array baris berisi array teks.
-- - Boleh dikaitkan ke nol atau beberapa permintaan desain (bast_permintaan),
--   hanya sebagai lampiran bukti; status permintaan tidak berubah.
-- - Penerima sering tidak punya akun, jadi penerimaan dicatat dengan salah satu cara:
--   langsung  : penerima tanda tangan di perangkat penyerah saat serah terima
--   akun      : penerima punya akun dan tanda tangan sendiri di aplikasi
--   scan      : surat dicetak, ditandatangani basah, lalu scan/fotonya diunggah
-- - Semua akses lewat API (service role); tabel tidak dibuka untuk client.

create table if not exists public.bast_jenis (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  nama             text not null,
  -- Bagian nomor: GMI.CR.F.001.002 /IT-DESIGN/BAST-<kode>/<tahun>
  kode             text not null,
  -- Boleh memuat {tahun}, diganti tahun tanggal BAST saat form diisi
  judul_default    text,
  mode_default     text not null default 'daftar' check (mode_default in ('daftar', 'tabel')),
  kolom_default    jsonb not null default '[]'::jsonb check (jsonb_typeof(kolom_default) = 'array'),
  klausul_default  text,
  urutan           integer not null default 0,
  created_by       uuid references public.user_profiles(id) on delete set null
);

create unique index if not exists bast_jenis_nama_uidx on public.bast_jenis (lower(nama));

create table if not exists public.bast (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  no_dokumen          text not null,
  jenis_id            uuid references public.bast_jenis(id) on delete set null,
  -- Salinan nama jenis agar dokumen lama tetap utuh walau jenisnya diubah/dihapus
  jenis_nama          text not null,
  tanggal             date not null default current_date,
  kota                text not null default 'Bekasi',
  penyerah_id         uuid not null references public.user_profiles(id) on delete restrict,
  penyerah_divisi     text not null default 'Design & Multimedia',
  judul_barang        text not null,
  mode                text not null default 'daftar' check (mode in ('daftar', 'tabel')),
  kolom               jsonb not null default '[]'::jsonb check (jsonb_typeof(kolom) = 'array'),
  items               jsonb not null
                      check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  -- Site/departemen penerima, mis. "Site BA"
  penerima_instansi   text not null,
  -- Diisi bila penerima punya akun dan akan tanda tangan sendiri
  penerima_user_id    uuid references public.user_profiles(id) on delete set null,
  -- Perwakilan penerima; boleh kosong sampai serah terima dilakukan
  penerima_nama       text,
  penerima_dept       text,
  klausul             text,
  status              text not null default 'MENUNGGU' check (status in ('MENUNGGU', 'DITERIMA')),
  penyerah_ttd_path   text,
  penyerah_signed_at  timestamptz,
  penerima_ttd_path   text,
  penerima_signed_at  timestamptz,
  metode_terima       text check (metode_terima is null or metode_terima in ('langsung', 'akun', 'scan')),
  scan_path           text,
  scan_nama           text,
  -- Foto bukti serah terima (opsional): array path di storage
  bukti_paths         jsonb not null default '[]'::jsonb check (jsonb_typeof(bukti_paths) = 'array'),
  diterima_at         timestamptz,
  -- User yang mencatat penerimaan (penyerah/admin, atau penerima sendiri)
  diterima_oleh       uuid references public.user_profiles(id) on delete set null,
  created_by          uuid not null references public.user_profiles(id) on delete restrict
);

create index if not exists bast_created_at_idx on public.bast (created_at desc);
create index if not exists bast_penyerah_idx on public.bast (penyerah_id);
create index if not exists bast_penerima_user_idx on public.bast (penerima_user_id);

drop trigger if exists bast_set_updated_at on public.bast;
create trigger bast_set_updated_at
  before update on public.bast
  for each row execute function public.set_updated_at();

create table if not exists public.bast_permintaan (
  bast_id        uuid not null references public.bast(id) on delete cascade,
  permintaan_id  uuid not null references public.permintaan(id) on delete cascade,
  primary key (bast_id, permintaan_id)
);

create index if not exists bast_permintaan_permintaan_idx on public.bast_permintaan (permintaan_id);

create table if not exists public.bast_riwayat (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  bast_id     uuid not null references public.bast(id) on delete cascade,
  user_id     uuid references public.user_profiles(id) on delete set null,
  aksi        text not null,
  catatan     text
);

create index if not exists bast_riwayat_bast_idx on public.bast_riwayat (bast_id, created_at);

alter table public.bast_jenis enable row level security;
alter table public.bast enable row level security;
alter table public.bast_permintaan enable row level security;
alter table public.bast_riwayat enable row level security;

-- Jenis bawaan
insert into public.bast_jenis (nama, kode, judul_default, mode_default, kolom_default, klausul_default, urutan)
select * from (values
  (
    'ID Card', 'ID CARD', 'Stiker Id Card {tahun} Atas nama Berikut:', 'daftar', '[]'::jsonb,
    'Stiker yang sudah di berikan wajib ditempelkan pada kartu ID Card sebagai pengganti yang lama. Jika ada temuan ID Card yang belum di ganti atas nama yang terdapat di list tsb, maka bukan menjadi tanggung jawab tim IT-Design tapi menjadi tanggung jawab PIC departemen yang menerima',
    1
  ),
  (
    'Poster', 'POSTER', 'Poster dengan rincian berikut:', 'tabel', '["Nama Poster", "Ukuran", "Jumlah"]'::jsonb,
    'Poster yang sudah diserahkan menjadi tanggung jawab departemen penerima untuk dipasang dan dirawat. Kerusakan atau kehilangan setelah serah terima bukan menjadi tanggung jawab tim IT-Design.',
    2
  ),
  (
    'Sticker', 'STICKER', 'Sticker dengan rincian berikut:', 'tabel', '["Nama Sticker", "Ukuran", "Jumlah"]'::jsonb,
    'Sticker yang sudah diserahkan menjadi tanggung jawab departemen penerima untuk dipasang sesuai peruntukannya. Kerusakan atau kehilangan setelah serah terima bukan menjadi tanggung jawab tim IT-Design.',
    3
  )
) as v(nama, kode, judul_default, mode_default, kolom_default, klausul_default, urutan)
where not exists (select 1 from public.bast_jenis j where lower(j.nama) = lower(v.nama));

notify pgrst, 'reload schema';
