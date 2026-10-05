-- Daily Activity: lokasi pekerjaan (diambil dari profil akun) dan jam kerja.
-- Jalankan setelah 0016_create_master_tables.sql.

alter table public.daily_activities
  add column if not exists lokasi text,
  add column if not exists jam_mulai time,
  add column if not exists jam_selesai time;

alter table public.daily_activities
  drop constraint if exists daily_activities_jam_check;

alter table public.daily_activities
  add constraint daily_activities_jam_check
  check (jam_mulai is null or jam_selesai is null or jam_selesai > jam_mulai);

notify pgrst, 'reload schema';
