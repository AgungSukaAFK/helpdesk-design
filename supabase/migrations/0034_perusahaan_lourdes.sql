-- Perusahaan induk Lourdes (Corporate): user dengan perusahaan ini
-- dapat mengakses data GMI dan GIS sekaligus (lihat lib/profile-options.ts).
insert into public.master_perusahaan (nama) values
  ('Lourdes (Corporate)')
on conflict (nama) do nothing;

notify pgrst, 'reload schema';
