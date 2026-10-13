-- Halaman Tools Creative dihapus; datanya dipindah ke Daily Activity.
--   content_plan   -> 1 aktivitas per judul (tanggal = tgl mulai; baris "(tanpa judul)" dilewati)
--   target_project -> 1 aktivitas per project (progress realisasi/rencana di remarks)
-- evaluasi_designer & wla_item bukan aktivitas, tidak dipindah (tabel tetap ada).
-- Tabel lama TIDAK dihapus. Aman dijalankan ulang: baris yang sudah dipindah dilewati.
-- Jalankan setelah 0024_daily_activity_name_from_designer.sql.

begin;

-- Akun pemilik baris jika nama desainer tidak cocok dengan akun mana pun.
create temp table tc_fallback on commit drop as
select coalesce(
  (select id from public.user_profiles where id = 'bcfdf89c-d1e2-4602-80aa-005a1beb1d3c'),
  (select id from public.user_profiles where role = 'admin' order by created_at limit 1)
) as user_id;

-- ===== Content Plan =====
insert into public.daily_activities (
  user_id, activity_date, name, title, task_description, status, remarks, description,
  due_date, lokasi, jenis_pekerjaan
)
select
  coalesce(p.id, f.user_id),
  coalesce(c.tgl_mulai, c.due_date, c.tgl_selesai, c.tgl_publish, c.created_at::date),
  coalesce(nullif(trim(p.name), ''), nullif(trim(c.designer), ''), 'Creative Team'),
  c.judul,
  c.judul,
  case
    when lower(trim(c.status)) in ('published', 'done', 'designed', 'edited') then '✅ Done (Selesai)'
    when lower(trim(c.status)) = 'in progress' then '⚡ In Progress (Dalam Proses)'
    when lower(trim(c.status)) like 'revisi%' then '🔄 Revisi (Revisi Pengerjaan)'
    else '⏳ Waiting (Menunggu)'
  end,
  r.remarks,
  r.remarks,
  c.due_date,
  p.lokasi,
  case
    when c.jenis ilike 'video%' and c.status ilike 'edited' then 'Editing'
    when c.jenis ilike 'video%' then 'Videoshoot'
    when c.jenis ilike 'dokumentasi%' then 'Photografi'
    when coalesce(trim(c.jenis), '') = '' then 'Lainnya'
    else 'Design'
  end
from public.content_plan c
cross join tc_fallback f
left join lateral (
  select up.id, up.name, up.lokasi
  from public.user_profiles up
  where nullif(trim(c.designer), '') is not null
    and up.name ilike '%' || trim(c.designer) || '%'
  order by up.created_at
  limit 1
) p on true
cross join lateral (
  select concat_ws(E'\n',
    'Sumber: Tools Creative - Content Plan',
    'Jenis: ' || nullif(trim(c.jenis), ''),
    'Status asal: ' || nullif(trim(c.status), ''),
    'Selesai: ' || c.tgl_selesai::text,
    'Publish: ' || c.tgl_publish::text,
    nullif(trim(c.remarks), '')
  ) as remarks
) r
where (f.user_id is not null or p.id is not null)
  and c.judul <> '(tanpa judul)'
  and not exists (
    select 1 from public.daily_activities x
    where x.request_id is null
      and x.task_description = c.judul
      and x.remarks like 'Sumber: Tools Creative - Content Plan%'
      and x.activity_date = coalesce(c.tgl_mulai, c.due_date, c.tgl_selesai, c.tgl_publish, c.created_at::date)
  );

-- ===== Target Project =====
insert into public.daily_activities (
  user_id, activity_date, name, title, task_description, status, remarks, description,
  due_date, lokasi, jenis_pekerjaan
)
select
  coalesce(p.id, f.user_id),
  coalesce(t.tgl_mulai, t.created_at::date),
  coalesce(nullif(trim(p.name), ''), t.nama),
  t.aktivitas,
  t.aktivitas,
  case
    when t.rencana > 0 and t.realisasi >= t.rencana then '✅ Done (Selesai)'
    when t.status ilike 're-check%' then '🔄 Revisi (Revisi Pengerjaan)'
    when t.realisasi > 0 then '⚡ In Progress (Dalam Proses)'
    else '⏳ Waiting (Menunggu)'
  end,
  r.remarks,
  r.remarks,
  t.deadline,
  p.lokasi,
  'Design'
from public.target_project t
cross join tc_fallback f
left join lateral (
  select up.id, up.name, up.lokasi
  from public.user_profiles up
  where up.name ilike '%' || trim(t.nama) || '%'
  order by up.created_at
  limit 1
) p on true
cross join lateral (
  select concat_ws(E'\n',
    'Sumber: Tools Creative - Target Project',
    'Realisasi: ' || t.realisasi || ' / ' || t.rencana,
    'Status asal: ' || nullif(trim(t.status), ''),
    nullif(trim(t.remarks), ''),
    'Link: ' || nullif(trim(t.link), '')
  ) as remarks
) r
where (f.user_id is not null or p.id is not null)
  and not exists (
    select 1 from public.daily_activities x
    where x.request_id is null
      and x.task_description = t.aktivitas
      and x.remarks like 'Sumber: Tools Creative - Target Project%'
  );

commit;

notify pgrst, 'reload schema';
