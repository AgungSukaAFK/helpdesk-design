-- Daily Activity: jenis pekerjaan (Design, Photografi, Videoshoot, Editing, Meeting/Koordinasi).
-- Jalankan setelah 0017_daily_activity_lokasi_jam.sql.

alter table public.daily_activities
  add column if not exists jenis_pekerjaan text;

notify pgrst, 'reload schema';
