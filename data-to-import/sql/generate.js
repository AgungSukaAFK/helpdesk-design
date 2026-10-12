// Generator SQL import data Excel -> Supabase production.
// Jalankan: node data-to-import/sql/generate.js
// Output: 01_cek_sebelum_import.sql (read-only); 02_import.sql, 03_import_tools_creative.sql,
// 04_perbaiki_attendance.sql (masing-masing satu transaksi).
const fs = require("fs");
const path = require("path");
const XLSX = require("../../node_modules/xlsx");

const DIR = path.resolve(__dirname, "..");
const OUT = __dirname;

const load = (file, sheet) => {
  // raw: CSV dibaca sebagai teks apa adanya (tanpa ini "03.08.2026" ditebak jadi tanggal format US)
  const wb = XLSX.readFile(path.join(DIR, file), { raw: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet || wb.SheetNames[0]], {
    header: 1,
    defval: "",
    raw: false,
  });
};
const s = (v) => String(v ?? "").replace(/\r\n/g, "\n").trim();
const q = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const titleCase = (n) => n.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
const emailOf = (n) =>
  n.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).join(".") + "@demo.com";

// ---------- Tiket (permintaan) ----------
const TIKET_FILES = [
  "Laporan_Tiket_Design_01Aug26_sd_31Aug26.xlsx",
  "Laporan_Tiket_Design_01Sep26_sd_30Sep26.xlsx",
  "Laporan_Tiket_Design_01Oct26_sd_12Oct26.xlsx", // 01Oct-07Oct sudah tercakup di file ini
];
const DEPARTEMEN = { "HR/GA": "HR", K3: "HSE", Finance: "Finance", Service: "Service", SCM: "SCM" };
const projectOf = (judul, desk) => {
  const t = `${judul} ${desk}`.toLowerCase();
  if (/edit foto|foto/.test(judul.toLowerCase())) return "Photo Editing";
  if (/dokumentasi/.test(t)) return "Photo Product";
  if (/sertifikat/.test(t)) return "Design Sertifikat";
  if (/fl[iy]+e?r|flayer|fyler/.test(t)) return "Design Flyer";
  if (/brosur/.test(t)) return "Design Brosur";
  if (/stiker|sticker/.test(t)) return "Design Stiker";
  if (/danger tag|loto|label|lanyard/.test(t)) return "Design Label";
  if (/katalog|catalog/.test(t)) return "Design Catalog";
  if (/poster|campaign|sign/.test(t)) return "Design Poster";
  return "Lainnya";
};
const perusahaanOf = (lokasi) =>
  lokasi.startsWith("GMI") ? "PT. Garuda Mart Indonesia" : lokasi.startsWith("GIS") ? "PT. Global Inti Sejati" : null;
const ts = (d, t) => {
  const [dd, mm, yy] = s(d).split("-");
  return dd && t ? `${yy}-${mm}-${dd} ${s(t)}:00+07` : null;
};

const tiket = new Map();
for (const f of TIKET_FILES) {
  for (const r of load(f).slice(1)) {
    if (!s(r[1])) continue;
    tiket.set(s(r[1]), r);
  }
}
const tiketRows = [...tiket.values()].map((r) => {
  const judul = s(r[8]);
  const masalah = s(r[9]);
  const catatan = s(r[10]) === "-" ? null : s(r[10]);
  // Format sama dengan tiket Agustus yang sudah diinput manual di production
  const deskripsi = [
    masalah && masalah !== "-" ? masalah : null,
    catatan ? `Solusi/Catatan: ${catatan}` : null,
    s(r[19]) && s(r[19]) !== "-" ? `Durasi Pengerjaan: ${s(r[19])}` : null,
    `Referensi Tiket IT Helpdesk: ${s(r[1])}`,
  ].filter(Boolean).join("\n");
  return {
    kode: s(r[1]),
    pelapor: s(r[5]),
    departemen: DEPARTEMEN[s(r[6])] || s(r[6]),
    lokasi: s(r[7]),
    judul,
    deskripsi,
    project: projectOf(judul, masalah),
    catatan,
    teknisi: s(r[11]).toLowerCase().includes("paulus") ? "paulus" : "farel",
    created_at: ts(r[13], r[14]),
    progress_at: ts(r[15], r[16]),
    done_at: ts(r[17], r[18]),
  };
});

// Profil pelapor: departemen & lokasi yang paling sering muncul
const pelapor = new Map();
for (const t of tiketRows) {
  const p = pelapor.get(t.pelapor) || { dept: {}, lok: {} };
  p.dept[t.departemen] = (p.dept[t.departemen] || 0) + 1;
  p.lok[t.lokasi] = (p.lok[t.lokasi] || 0) + 1;
  pelapor.set(t.pelapor, p);
}
const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0][0];
const pelaporRows = [...pelapor].map(([nama, p]) => {
  const lokasi = top(p.lok);
  return { nama, display: titleCase(nama), email: emailOf(nama), departemen: top(p.dept), lokasi, perusahaan: perusahaanOf(lokasi) };
});

// ---------- Attendance ----------
const ATT_FILES = ["AttendanceReportAgustus2026.xlsx", "AttendanceReport September2026.xlsx", "AttendanceReportOktober2026.xlsx"];
const MON = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const attRows = [];
for (const f of ATT_FILES) {
  const m = load(f);
  const h = m.findIndex((r) => r[1] === "Emp No.");
  for (const r of m.slice(h + 1)) {
    if (!s(r[1])) continue;
    const [, mon, yy] = s(r[5]).split(" ");
    attRows.push({
      period_month: `${yy}-${MON[mon]}`,
      employee_no: s(r[1]),
      name: s(r[2]).replace(/\s+/g, " "),
      date_text: s(r[5]),
      shift: s(r[6]) || "-",
      start_time: s(r[9]) || "-",
      end_time: s(r[10]) || "-",
      status: s(r[20]) || s(r[19]), // "Others Status" mis. "EAI,PRS" (dipakai badge & KPI)
    });
  }
}

// ---------- Daily activity (Job List) ----------
const STATUS = { done: "✅ Done (Selesai)", progress: "⚡ In Progress (Dalam Proses)" };
const jenisOf = (t) => {
  t = t.toLowerCase();
  if (/meeting|rapat|koordinasi|s[ae]f?t[ae]y talk|briefing|evaluasi/.test(t)) return "Meeting/Koordinasi";
  if (/edit|retouch/.test(t)) return "Editing";
  if (/video|shooting|syuting/.test(t)) return "Videoshoot";
  if (/foto|photo/.test(t)) return "Photografi";
  if (/export|upload|import/.test(t)) return "Export";
  if (/sortir/.test(t)) return "Sortir List";
  if (/mengambil|ambil barang/.test(t)) return "Mengambil Barang";
  if (/list|numbering|perhitungan|budget/.test(t)) return "Membuat List";
  if (/design|desain|poster|fl[ay]+er|banner|katalog|catalog|brosur|stiker|sertifikat|layout|kalender|template|id card|lowker|revisi/.test(t))
    return "Design";
  return "Lainnya";
};
const items = (cell) => {
  const out = [];
  for (const line of s(cell).split("\n")) {
    const m = line.match(/^\s*(\d+)[.)]?[\s\t]*(.*)$/);
    if (m && m[2].trim()) out.push(m[2].trim());
    else if (line.trim() && out.length) out[out.length - 1] += " " + line.trim();
    else if (line.trim()) out.push(line.trim());
  }
  return out;
};
const toIso = (d) => {
  const m = s(d).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) throw new Error(`Format tanggal Job List tidak dikenal: "${d}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
};
const actRows = [];
for (const [f, sheet] of [["Tools Creative Agustus 2026.csv"], ["Tools Creative September 2026.xlsx", "Job List"]]) {
  let dates = [null, null];
  for (const r of load(f, sheet)) {
    if (s(r[0]).includes("JOB LIST")) {
      dates = [r[3], r[8]];
      continue;
    }
    for (const [off, d] of [[0, dates[0]], [5, dates[1]]]) {
      const name = s(r[off]);
      if (!name || name === "Name" || !s(r[off + 1]) || !d) continue;
      const tasks = items(r[off + 1]);
      const sts = items(r[off + 2]);
      const rms = items(r[off + 3]);
      tasks.forEach((task, i) => {
        const st = (sts[i] || "Done").toLowerCase();
        const rm = rms[i] && !/^(done|progress)$/i.test(rms[i]) ? rms[i] : null;
        actRows.push({
          designer: name.toLowerCase().includes("paulus") ? "paulus" : "farel",
          activity_date: toIso(d),
          task: task.slice(0, 2000),
          status: STATUS[st] || STATUS.done,
          remarks: rm,
          jenis: jenisOf(task),
        });
      });
    }
  }
}

// ---------- 01: cek (read-only) ----------
const pelaporValues = pelaporRows.map((p) => `(${q(p.nama)}, ${q(p.email)})`).join(",\n  ");
const kodeList = tiketRows.map((t) => q(t.kode)).join(", ");
const cek = `-- 01_cek_sebelum_import.sql — READ-ONLY. Jalankan dulu & kirim hasilnya sebelum menjalankan 02_import.sql.
-- Generated by generate.js

-- A. Kolom yang dipakai import (pastikan semua ada; hasil harus 0 baris "missing")
select t.tbl, t.col, case when c.column_name is null then 'MISSING' else 'ok' end as status
from (values
  ('user_profiles','name'),('user_profiles','role'),('user_profiles','departemen'),('user_profiles','lokasi'),('user_profiles','perusahaan'),
  ('permintaan','departemen'),('permintaan','progress_at'),('permintaan','done_at'),('permintaan','last_status_note'),
  ('daily_activities','jenis_pekerjaan'),('daily_activities','lokasi'),('daily_activities','departemen'),
  ('attendance','period_month')
) as t(tbl, col)
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = t.col
order by status, tbl;

-- B. Akun desainer (Paulus & Farel) — masing-masing harus tepat 1 akun
select 'paulus' as kunci, id, name, email, role, lokasi from public.user_profiles where name ilike '%paulus%'
union all
select 'farel', id, name, email, role, lokasi from public.user_profiles where name ilike '%farel%';

-- C. Pelapor tiket: sudah punya akun? (exact = dipakai otomatis; kandidat = perlu konfirmasi manual)
with p(nama, email_baru) as (values
  ${pelaporValues}
)
select p.nama,
       exact.email                                   as akun_exact,
       (select string_agg(up.name || ' <' || coalesce(up.email,'-') || '>', '; ')
          from public.user_profiles up
         where up.name ilike '%' || split_part(p.nama, ' ', 1) || '%'
           and (exact.id is null or up.id <> exact.id)) as kandidat_mirip,
       p.email_baru,
       exists (select 1 from auth.users u where lower(u.email) = p.email_baru) as email_baru_sudah_ada
from p
left join public.user_profiles exact on lower(btrim(exact.name)) = lower(p.nama)
order by p.nama;

-- D. Data yang sudah ada di periode yang sama (import tidak menghapus apa pun; baris yang persis sama dilewati)
select 'attendance' as tabel, period_month as periode, count(*) as jumlah
from public.attendance where period_month in ('2026-08','2026-09','2026-10') group by 2
union all
select 'daily_activities (non-permintaan)', to_char(activity_date,'YYYY-MM'), count(*)
from public.daily_activities where request_id is null and activity_date between '2026-07-31' and '2026-10-31' group by 2
union all
select 'permintaan', to_char(created_at,'YYYY-MM'), count(*)
from public.permintaan where created_at >= '2026-08-01' group by 2
order by 1, 2;

-- E. Tiket yang kodenya sudah ada di permintaan (akan dilewati)
select id, judul, created_at from public.permintaan
where substring(deskripsi from '(?:Kode Tiket|Referensi Tiket IT Helpdesk): (IT\\d+)') in (${kodeList});
`;

// ---------- 02: import ----------
const vals = (rows, cols) => rows.map((r) => `  (${cols.map((c) => q(r[c])).join(", ")})`).join(",\n");
const imp = `-- 02_import.sql — Import data Agustus–Oktober 2026 ke production.
-- Generated by generate.js. Satu transaksi: kalau ada error, tidak ada yang tersimpan.
-- Sifat import: HANYA MENAMBAH. Tidak ada DELETE/UPDATE ke data lama.
-- Yang sudah ada dilewati (tiket dgn kode tiket sama; hari Job List yang sudah terisi),
-- jadi aman dijalankan ulang.
--
-- Isi:   ${tiketRows.length} tiket -> permintaan (+ riwayat, + daily_activities via trigger)
--        ${pelaporRows.length} pelapor -> akun dicocokkan / dibuat (<nama.lengkap>@demo.com / demo1234)
--        ${actRows.length} item Job List -> daily_activities

begin;

-- ===== 0. Override pencocokan akun pelapor (opsional) =====
-- Isi jika hasil cek C menunjukkan pelapor sudah punya akun dengan nama berbeda.
-- Contoh: ('Daimatunnisa Ayu P', 'daimatunnisa@perusahaan.com')
create temp table imp_override (nama text primary key, email text not null) on commit drop;
insert into imp_override values
  ('sarah nurul aulia',    'sarrahnurul02@gmail.com'),     -- akun "Sarrah Nurul"
  ('Sazkya Dianur Putri',  'hr.garudamart@gmail.com'),     -- akun "Sazkia"
  ('Nabila Kasyifa Putri', 'nabila.globalinti@gmail.com'); -- akun "Nabila"

-- ===== 1. Staging =====
create temp table imp_pelapor (nama text primary key, display text, email text, departemen text, lokasi text, perusahaan text, user_id uuid, baru boolean not null default false) on commit drop;
insert into imp_pelapor (nama, display, email, departemen, lokasi, perusahaan) values
${vals(pelaporRows, ["nama", "display", "email", "departemen", "lokasi", "perusahaan"])};

create temp table imp_tiket (kode text primary key, pelapor text, departemen text, lokasi text, judul text, deskripsi text,
  project text, catatan text, teknisi text, created_at timestamptz, progress_at timestamptz, done_at timestamptz) on commit drop;
insert into imp_tiket values
${vals(tiketRows, ["kode", "pelapor", "departemen", "lokasi", "judul", "deskripsi", "project", "catatan", "teknisi", "created_at", "progress_at", "done_at"])};

create temp table imp_activity (designer text, activity_date date, task text, status text, remarks text, jenis text, urut serial) on commit drop;
insert into imp_activity (designer, activity_date, task, status, remarks, jenis) values
${vals(actRows, ["designer", "activity_date", "task", "status", "remarks", "jenis"])};

-- ===== 2. Akun desainer (harus tepat 1 per orang) =====
create temp table imp_designer (kunci text primary key, user_id uuid, nama text, lokasi text) on commit drop;
do $$
declare k text; n int;
begin
  foreach k in array array['paulus','farel'] loop
    select count(*) into n from public.user_profiles where name ilike '%' || k || '%';
    if n <> 1 then
      raise exception 'Akun desainer "%" ditemukan % kali di user_profiles (harus 1). Cek query B di 01_cek.', k, n;
    end if;
    insert into imp_designer
    select k, id, name, lokasi from public.user_profiles where name ilike '%' || k || '%';
  end loop;
end $$;

-- ===== 3. Akun pelapor: override -> nama sama persis -> email demo -> buat baru =====
update imp_pelapor p set user_id = u.id
from imp_override o join auth.users u on lower(u.email) = lower(o.email)
where o.nama = p.nama;

update imp_pelapor p set user_id = up.id
from public.user_profiles up
where p.user_id is null and lower(btrim(up.name)) = lower(p.nama);

update imp_pelapor p set user_id = u.id
from auth.users u
where p.user_id is null and lower(u.email) = p.email;

update imp_pelapor set user_id = gen_random_uuid(), baru = true where user_id is null
returning nama as "akun baru dibuat", email;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token
)
select '00000000-0000-0000-0000-000000000000', p.user_id, 'authenticated', 'authenticated', p.email,
       extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('name', p.display), now(), now(),
       '', '', '', '', '', '', '', ''
from imp_pelapor p
where not exists (select 1 from auth.users u where u.id = p.user_id);

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), p.user_id::text, p.user_id,
       jsonb_build_object('sub', p.user_id::text, 'email', p.email, 'email_verified', true),
       'email', now(), now(), now()
from imp_pelapor p
where not exists (select 1 from auth.identities i where i.user_id = p.user_id and i.provider = 'email');

-- Profil hanya untuk akun baru (baris dibuat trigger auth.users, lalu dilengkapi). Akun lama tidak diubah.
insert into public.user_profiles (id, email, name, role, departemen, lokasi, perusahaan)
select p.user_id, p.email, p.display, 'user', p.departemen, p.lokasi, p.perusahaan
from imp_pelapor p
where p.baru
on conflict (id) do update set
  name = excluded.name, departemen = excluded.departemen,
  lokasi = excluded.lokasi, perusahaan = excluded.perusahaan;

-- ===== 4. Tiket -> permintaan =====
-- Trigger bawaan otomatis membuat baris daily_activities ("Permintaan Desain") & riwayat.
create temp table imp_permintaan_baru (id uuid, kode text) on commit drop;

with ins as (
  insert into public.permintaan (
    created_at, updated_at, due_date, judul, deskripsi, project, departemen, status,
    requester, admin, files, progress_at, done_at, last_status_note
  )
  select t.created_at, t.done_at, t.done_at, t.judul, t.deskripsi, t.project, t.departemen, 'DONE',
         p.user_id, d.user_id, '[]'::jsonb, t.progress_at, t.done_at, t.catatan
  from imp_tiket t
  join imp_pelapor p on p.nama = t.pelapor
  join imp_designer d on d.kunci = t.teknisi
  where not exists (
    select 1 from public.permintaan x
    where substring(x.deskripsi from '(?:Kode Tiket|Referensi Tiket IT Helpdesk): (IT\\d+)') = t.kode
  )
  order by t.created_at
  returning id, substring(deskripsi from 'Referensi Tiket IT Helpdesk: (IT\\d+)') as kode
)
insert into imp_permintaan_baru select id, kode from ins;

-- Timeline riwayat: trigger mencatat 1 baris (null -> DONE). Diganti jadi TO DO -> PROGRESS -> DONE.
update public.permintaan_riwayat r
set status_to = 'TO DO', catatan = null
from imp_permintaan_baru b
where r.permintaan_id = b.id and r.status_from is null and r.status_to = 'DONE';

insert into public.permintaan_riwayat (permintaan_id, created_at, status_from, status_to, changed_by, catatan)
select b.id, t.progress_at, 'TO DO', 'PROGRESS', d.user_id, null
from imp_permintaan_baru b join imp_tiket t on t.kode = b.kode join imp_designer d on d.kunci = t.teknisi
union all
select b.id, t.done_at, 'PROGRESS', 'DONE', d.user_id, t.catatan
from imp_permintaan_baru b join imp_tiket t on t.kode = b.kode join imp_designer d on d.kunci = t.teknisi;

-- ===== 5. Attendance =====
-- Tidak di sini: data Agu–Okt sudah ada di production (format rusak). Lihat 04_perbaiki_attendance.sql.

-- ===== 6. Job List -> daily_activities =====
insert into public.daily_activities (
  user_id, activity_date, name, title, task_description, status, remarks, description, lokasi, jenis_pekerjaan
)
select d.user_id, a.activity_date, initcap(a.designer), a.task, a.task, a.status, a.remarks, a.remarks, d.lokasi, a.jenis
from imp_activity a
join imp_designer d on d.kunci = a.designer
-- Job List Agu–Sep sudah diinput manual (teksnya sebagian diedit), jadi pencocokan per item tidak andal.
-- Hari yang sudah punya aktivitas desainer tsb dilewati seluruhnya.
where not exists (
  select 1 from public.daily_activities x
  where x.request_id is null and x.user_id = d.user_id and x.activity_date = a.activity_date
)
order by a.urut;

-- ===== 7. Ringkasan =====
select 'permintaan baru' as item, count(*) as jumlah from imp_permintaan_baru
union all select 'akun pelapor baru dibuat', count(*) from imp_pelapor where baru
union all select 'daily_activities Job List baru', (select count(*) from public.daily_activities where request_id is null and created_at = now())
union all select 'daily_activities Jul–Sep 2026 non-permintaan (total sekarang)', count(*) from public.daily_activities
  where request_id is null and activity_date between '2026-07-31' and '2026-09-30';

commit;
-- Mau uji coba dulu tanpa menyimpan? Ganti "commit;" di atas dengan "rollback;".
`;

// ---------- Safety Toolbox (Absensi STB) ----------
const empNo = new Map(attRows.map((a) => [a.name.toLowerCase(), a.employee_no]));
const stbRows = [];
for (const [file, period] of [
  ["Absensi STB - GIS Agustus.xlsx", "2026-08"],
  ["Absensi STB - GIS September.xlsx", "2026-09"],
]) {
  const m = load(file);
  const days = m[1]; // baris nomor tanggal, mulai kolom 2
  for (const r of m.slice(3)) {
    const name = s(r[1]).replace(/\s+/g, " ");
    if (!name) continue;
    const schedule = {};
    for (let c = 2; c < days.length; c++) {
      if (s(days[c]) && s(r[c])) schedule[Number(days[c])] = s(r[c]);
    }
    const no = empNo.get(name.toLowerCase()) || null;
    stbRows.push({
      id: `safety-toolbox-meeting-import-${period}-${no || name.toLowerCase().replace(/\W+/g, "-")}`,
      period_month: period,
      employee_no: no,
      name,
      schedule: JSON.stringify(schedule),
      notes: `Diimpor dari ${file}`,
    });
  }
}

// ---------- Tools Creative September 2026.xlsx (sheet lain) ----------
const TC = "Tools Creative September 2026.xlsx";
const tcWb = XLSX.readFile(path.join(DIR, TC));
const loadRaw = (sheet) => XLSX.utils.sheet_to_json(tcWb.Sheets[sheet], { header: 1, defval: "", raw: true });
const serialToIso = (v) => {
  if (typeof v !== "number") return null;
  const d = XLSX.SSF.parse_date_code(v);
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
};
const BULAN_ID = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12 };
const idDateToIso = (v) => {
  const m = s(v).toLowerCase().match(/^(\d{1,2}) (\w+) (\d{4})$/);
  return m && BULAN_ID[m[2]] ? `${m[3]}-${String(BULAN_ID[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};
const num = (v) => (v === "" || v === null || Number.isNaN(Number(v)) ? null : Number(v));

// Design Month -> content_plan
const contentRows = [];
for (const r of loadRaw("Design Month")) {
  const jenis = s(r[0]);
  if (!jenis || ["Type of Design", "JOB LIST per Month", "Design TO-DO"].includes(jenis)) continue;
  contentRows.push({
    jenis,
    judul: s(r[1]) || "(tanpa judul)",
    tgl_mulai: serialToIso(r[2]),
    tgl_selesai: serialToIso(r[3]),
    due_date: serialToIso(r[4]),
    tgl_publish: serialToIso(r[5]),
    status: s(r[6]) || null,
    designer: s(r[7]) || null,
    remarks: s(r[8]) || null,
  });
}

// Todo List -> target_project
const targetRows = [];
for (const r of loadRaw("Todo List")) {
  if (typeof r[1] !== "number" || !s(r[2])) continue;
  const deadline = serialToIso(r[8]);
  targetRows.push({
    nama: s(r[2]),
    aktivitas: s(r[3]),
    rencana: num(r[4]) ?? 0,
    realisasi: num(r[5]) ?? 0,
    tgl_mulai: idDateToIso(r[7]),
    deadline,
    status: deadline ? null : s(r[8]).replace(/^Re-Chek$/i, "Re-Check") || null,
    remarks: s(r[9]) || null,
    link: s(r[10]) || null,
  });
}

// Evaluasi -> evaluasi_designer (sheet ada di file September)
const evalRows = [];
let evalDesigner = null;
for (const r of loadRaw("Evaluasi")) {
  if (typeof r[3] !== "number" || !s(r[2])) continue;
  if (s(r[1])) evalDesigner = s(r[1]);
  evalRows.push({
    periode: "2026-09",
    designer: evalDesigner,
    project: s(r[2]),
    kreativitas: r[3], brief: r[4], deadline: r[5], kualitas: r[6], komunikasi: r[7], revisi: r[8],
  });
}

// WLA per individu -> wla_item. "Paulus" (versi lama) & "Karyawan B/C" (template HR) tidak diimpor.
const WLA_SHEETS = ["Paulus Sianipar", "Farel", "Sherlyn", "Yoga Kusuma", "Angga Kusuma"];
const wlaRows = [];
for (const sheet of WLA_SHEETS) {
  const m = loadRaw(sheet);
  const meta = (label) => s((m.find((r) => s(r[1]) === label) || [])[2]);
  const header = m.findIndex((r) => s(r[1]) === "No");
  for (const r of m.slice(header + 1)) {
    if (typeof r[1] !== "number" || r[1] === 0 || !s(r[3])) continue;
    wlaRows.push({
      nama: meta("Nama"),
      posisi: meta("Posisi"),
      divisi: meta("Divisi"),
      no_urut: r[1],
      tanggung_jawab: s(r[2]) || null,
      aktivitas: s(r[3]),
      keluaran: s(r[4]) || null,
      pelaksanaan: s(r[5]) || null,
      frekuensi: num(r[6]) ?? 1,
      satuan: s(r[8]) || null,
      jumlah_keluaran: num(r[9]) ?? 0,
      durasi_menit: num(r[10]) ?? 0,
      catatan: s(r[12]) || null,
    });
  }
}

const tc = `-- 03_import_tools_creative.sql — Absensi STB + data Tools Creative (Content Plan, Target Project, Evaluasi, WLA).
-- Generated by generate.js. Jalankan SETELAH supabase/migrations/0023_tools_creative.sql.
-- Hanya menambah data; baris yang sudah ada dilewati, aman dijalankan ulang.
--
-- Isi:   ${stbRows.length} personil Safety Toolbox (Agu & Sep 2026) -> safety_toolbox_meeting_hse_roster
--        ${contentRows.length} content plan, ${targetRows.length} target project, ${evalRows.length} evaluasi, ${wlaRows.length} item WLA

begin;

-- ===== Safety Toolbox Meeting (Absensi STB) =====
insert into public.safety_toolbox_meeting_hse_roster (id, period_month, employee_no, name, role, schedule, notes)
select v.id, v.period_month, v.employee_no, v.name, 'Designer', v.schedule::jsonb, v.notes
from (values
${vals(stbRows, ["id", "period_month", "employee_no", "name", "schedule", "notes"])}
) as v(id, period_month, employee_no, name, schedule, notes)
where not exists (
  select 1 from public.safety_toolbox_meeting_hse_roster x
  where x.id = v.id or (x.period_month = v.period_month and lower(btrim(x.name)) = lower(v.name))
);

-- ===== Content Plan (Design Month) =====
insert into public.content_plan (jenis, judul, tgl_mulai, tgl_selesai, due_date, tgl_publish, status, designer, remarks)
select v.jenis, v.judul, v.tgl_mulai::date, v.tgl_selesai::date, v.due_date::date, v.tgl_publish::date, v.status, v.designer, v.remarks
from (values
${vals(contentRows, ["jenis", "judul", "tgl_mulai", "tgl_selesai", "due_date", "tgl_publish", "status", "designer", "remarks"])}
) as v(jenis, judul, tgl_mulai, tgl_selesai, due_date, tgl_publish, status, designer, remarks)
where not exists (
  select 1 from public.content_plan x
  where x.judul = v.judul and x.jenis is not distinct from v.jenis
    and x.tgl_mulai is not distinct from v.tgl_mulai::date and x.designer is not distinct from v.designer
);

-- ===== Target Project (Todo List) =====
insert into public.target_project (nama, aktivitas, rencana, realisasi, tgl_mulai, deadline, status, remarks, link)
select v.nama, v.aktivitas, v.rencana::int, v.realisasi::int, v.tgl_mulai::date, v.deadline::date, v.status, v.remarks, v.link
from (values
${vals(targetRows, ["nama", "aktivitas", "rencana", "realisasi", "tgl_mulai", "deadline", "status", "remarks", "link"])}
) as v(nama, aktivitas, rencana, realisasi, tgl_mulai, deadline, status, remarks, link)
where not exists (
  select 1 from public.target_project x where x.nama = v.nama and x.aktivitas = v.aktivitas
);

-- ===== Evaluasi Designer =====
insert into public.evaluasi_designer (periode, designer, project, kreativitas, brief, deadline, kualitas, komunikasi, revisi)
select v.periode, v.designer, v.project, v.k::smallint, v.b::smallint, v.d::smallint, v.q::smallint, v.c::smallint, v.r::smallint
from (values
${vals(evalRows, ["periode", "designer", "project", "kreativitas", "brief", "deadline", "kualitas", "komunikasi", "revisi"])}
) as v(periode, designer, project, k, b, d, q, c, r)
where not exists (
  select 1 from public.evaluasi_designer x
  where x.periode = v.periode and x.designer = v.designer and x.project = v.project
);

-- ===== WLA =====
insert into public.wla_item (nama, posisi, divisi, no_urut, tanggung_jawab, aktivitas, keluaran, pelaksanaan,
  frekuensi, satuan, jumlah_keluaran, durasi_menit, catatan)
select v.nama, v.posisi, v.divisi, v.no_urut::int, v.tanggung_jawab, v.aktivitas, v.keluaran, v.pelaksanaan,
       v.frekuensi::numeric, v.satuan, v.jumlah::numeric, v.durasi::numeric, v.catatan
from (values
${vals(wlaRows, ["nama", "posisi", "divisi", "no_urut", "tanggung_jawab", "aktivitas", "keluaran", "pelaksanaan", "frekuensi", "satuan", "jumlah_keluaran", "durasi_menit", "catatan"])}
) as v(nama, posisi, divisi, no_urut, tanggung_jawab, aktivitas, keluaran, pelaksanaan, frekuensi, satuan, jumlah, durasi, catatan)
where not exists (
  select 1 from public.wla_item x
  where x.nama = v.nama and x.no_urut is not distinct from v.no_urut::int and x.aktivitas = v.aktivitas
);

-- ===== Ringkasan =====
select 'safety toolbox Agu–Sep 2026' as tabel, count(*) as total_sekarang
  from public.safety_toolbox_meeting_hse_roster where period_month in ('2026-08','2026-09')
union all select 'content_plan', count(*) from public.content_plan
union all select 'target_project', count(*) from public.target_project
union all select 'evaluasi_designer', count(*) from public.evaluasi_designer
union all select 'wla_item', count(*) from public.wla_item;

commit;
-- Mau uji coba dulu tanpa menyimpan? Ganti "commit;" di atas dengan "rollback;".
`;

// ---------- 04: perbaiki attendance yang sudah diimpor lewat aplikasi ----------
// Importer di halaman Attendance salah memetakan kolom AttendanceReport: employee_no berisi nama,
// name berisi "Head Office", jam masuk/pulang "-". Baris diperbaiki di tempat (tidak dihapus/ditambah).
const att = `-- 04_perbaiki_attendance.sql — Perbaiki ${attRows.length} baris presensi Agu–Okt 2026 yang kolomnya tertukar.
-- Generated by generate.js. Hanya UPDATE baris rusak (employee_no bukan "GIS..."); tidak ada DELETE/INSERT.
-- Aman dijalankan ulang: baris yang sudah benar tidak tersentuh lagi.

begin;

with f(employee_no, name, date_text, shift, start_time, end_time, status) as (values
${vals(attRows, ["employee_no", "name", "date_text", "shift", "start_time", "end_time", "status"])}
)
update public.attendance x
set employee_no = f.employee_no,
    name        = f.name,
    shift       = f.shift,
    start_time  = f.start_time,
    end_time    = f.end_time,
    status      = f.status
from f
where x.employee_no !~ '^GIS[0-9]+$'
  and regexp_replace(btrim(x.employee_no), '\\s+', ' ', 'g') = f.name
  and x.date_text = f.date_text;

-- Ringkasan: harus 0 baris rusak tersisa
select period_month, employee_no, name, count(*) as jumlah,
       count(*) filter (where start_time <> '-') as ada_jam
from public.attendance
where period_month in ('2026-08', '2026-09', '2026-10')
group by 1, 2, 3
order by 1, 3;

commit;
-- Mau uji coba dulu tanpa menyimpan? Ganti "commit;" di atas dengan "rollback;".
`;

fs.writeFileSync(path.join(OUT, "01_cek_sebelum_import.sql"), cek);
fs.writeFileSync(path.join(OUT, "02_import.sql"), imp);
fs.writeFileSync(path.join(OUT, "03_import_tools_creative.sql"), tc);
fs.writeFileSync(path.join(OUT, "04_perbaiki_attendance.sql"), att);
console.log({ tiket: tiketRows.length, pelapor: pelaporRows.length, attendance: attRows.length, activity: actRows.length });
console.log({ stb: stbRows.length, content: contentRows.length, target: targetRows.length, evaluasi: evalRows.length, wla: wlaRows.length });
console.table(pelaporRows);
