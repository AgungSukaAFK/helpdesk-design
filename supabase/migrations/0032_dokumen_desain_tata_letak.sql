-- Tata letak gambar hasil di lembar Dokumen Form Desain.
-- - hasil_kolom: jumlah kolom grid (null = otomatis sesuai jumlah gambar)
-- - Pengaturan per gambar (lebar, tinggi, skala, rata, caption) disimpan di
--   setiap elemen hasil_files, jadi tidak perlu kolom baru.
--
-- Juga menyamakan database yang sempat menjalankan versi awal 0031
-- (kolom hasil_file tunggal, tanpa tanggal_dokumen).

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dokumen_desain' and column_name = 'hasil_file'
  ) then
    alter table public.dokumen_desain add column if not exists hasil_files jsonb;
    update public.dokumen_desain
      set hasil_files = jsonb_build_array(hasil_file)
      where hasil_files is null;
    alter table public.dokumen_desain alter column hasil_files set not null;
    alter table public.dokumen_desain
      add constraint dokumen_desain_hasil_files_check
      check (jsonb_typeof(hasil_files) = 'array' and jsonb_array_length(hasil_files) > 0);
    alter table public.dokumen_desain drop column hasil_file;
  end if;
end;
$$;

alter table public.dokumen_desain
  add column if not exists tanggal_dokumen date not null default current_date,
  add column if not exists hasil_kolom smallint
    check (hasil_kolom is null or hasil_kolom between 1 and 4);

notify pgrst, 'reload schema';
