-- Tambah lokasi GMI J4
insert into public.master_lokasi (nama) values
  ('GMI J4')
on conflict (nama) do nothing;

notify pgrst, 'reload schema';
