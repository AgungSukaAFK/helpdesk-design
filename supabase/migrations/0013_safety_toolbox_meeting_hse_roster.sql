-- Safety Toolbox Meeting HSE: roster standby personil HSE per bulan (YYYY-MM).
-- Jalankan di Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
--
-- Catatan:
--   id memakai text (bukan uuid) karena aplikasi memakai id tekstual seperti
--   'safety-toolbox-meeting-2026-06-01' sehingga localStorage dan database
--   memakai kunci yang sama tanpa perlu pemetaan.

create table if not exists public.safety_toolbox_meeting_hse_roster (
  id            text primary key,
  period_month  text not null,
  employee_no   text,
  name          text not null,
  role          text default 'HSE Officer',
  phone         text,
  schedule      jsonb not null default '{}'::jsonb,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint safety_toolbox_meeting_hse_period_month_format
    check (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

-- Pastikan kolom lengkap jika tabel sudah pernah dibuat sebelumnya
alter table public.safety_toolbox_meeting_hse_roster
  add column if not exists period_month text,
  add column if not exists employee_no text,
  add column if not exists role text,
  add column if not exists phone text,
  add column if not exists notes text;

update public.safety_toolbox_meeting_hse_roster
   set period_month = to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM')
 where period_month is null;

update public.safety_toolbox_meeting_hse_roster
   set schedule = '{}'::jsonb
 where schedule is null;

alter table public.safety_toolbox_meeting_hse_roster
  alter column period_month set not null,
  alter column schedule set not null;

-- Index untuk filter per bulan dan pencarian nama
create index if not exists safety_toolbox_meeting_hse_period_month_idx
  on public.safety_toolbox_meeting_hse_roster (period_month);
create index if not exists safety_toolbox_meeting_hse_name_idx
  on public.safety_toolbox_meeting_hse_roster (name);
create index if not exists safety_toolbox_meeting_hse_employee_no_idx
  on public.safety_toolbox_meeting_hse_roster (employee_no);

-- Trigger untuk update updated_at otomatis
create or replace function public.set_safety_toolbox_meeting_hse_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists safety_toolbox_meeting_hse_set_updated_at
  on public.safety_toolbox_meeting_hse_roster;
create trigger safety_toolbox_meeting_hse_set_updated_at
  before update on public.safety_toolbox_meeting_hse_roster
  for each row execute function public.set_safety_toolbox_meeting_hse_updated_at();

-- Aktifkan RLS
alter table public.safety_toolbox_meeting_hse_roster enable row level security;

-- Policy agar user authenticated dapat membaca roster HSE
drop policy if exists "safety toolbox meeting hse authenticated read"
  on public.safety_toolbox_meeting_hse_roster;
create policy "safety toolbox meeting hse authenticated read"
  on public.safety_toolbox_meeting_hse_roster for select to authenticated
  using (true);

-- Policy agar user authenticated dapat menambah roster HSE
drop policy if exists "safety toolbox meeting hse authenticated insert"
  on public.safety_toolbox_meeting_hse_roster;
create policy "safety toolbox meeting hse authenticated insert"
  on public.safety_toolbox_meeting_hse_roster for insert to authenticated
  with check (true);

-- Policy agar user authenticated dapat mengubah roster HSE
drop policy if exists "safety toolbox meeting hse authenticated update"
  on public.safety_toolbox_meeting_hse_roster;
create policy "safety toolbox meeting hse authenticated update"
  on public.safety_toolbox_meeting_hse_roster for update to authenticated
  using (true)
  with check (true);

-- Policy agar user authenticated dapat menghapus roster HSE
drop policy if exists "safety toolbox meeting hse authenticated delete"
  on public.safety_toolbox_meeting_hse_roster;
create policy "safety toolbox meeting hse authenticated delete"
  on public.safety_toolbox_meeting_hse_roster for delete to authenticated
  using (true);

-- Data baseline Juni 2026 (hasil import Excel, bukan data generate).
-- Idempotent: aman dijalankan berulang kali.
insert into public.safety_toolbox_meeting_hse_roster
  (id, period_month, employee_no, name, role, phone, schedule, notes)
values
  (
    'safety-toolbox-meeting-2026-06-01',
    '2026-06',
    'GIS19040039',
    'Paulus Petrus Parlindungan Sianipar',
    'HSE Coordinator',
    '0812-3456-7890',
    '{"1":"H","4":"h","8":"H","11":"h","15":"H","18":"H","22":"H","25":"H","29":"H"}'::jsonb,
    'Roster Standby HSE Juni 2026'
  ),
  (
    'safety-toolbox-meeting-2026-06-02',
    '2026-06',
    'GIS25100212',
    'Muhammad Farel Ramadhan',
    'HSE Officer',
    '0813-9876-5432',
    '{"1":"H","4":"h","8":"H","11":"h","15":"H","18":"H","22":"H","25":"H","29":"H"}'::jsonb,
    'Roster Standby HSE Juni 2026'
  )
on conflict (id) do nothing;

-- Notifikasi reload schema ke PostgREST
notify pgrst, 'reload schema';