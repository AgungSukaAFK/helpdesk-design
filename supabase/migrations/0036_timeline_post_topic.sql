-- Timeline Creative Tim: jadwal posting (Post Topic) + penyesuaian Timeline Desain (Gantt)
-- mengikuti file "Timeline Creative Tim.xlsx".
-- Jalankan di Supabase SQL Editor setelah 0035_timeline_desain.sql. Aman dijalankan ulang.

-- 1. Jadwal posting (sheet "Timeline Post Topic") ---------------------------
create table if not exists public.timeline_post_topic (
  id               uuid primary key default gen_random_uuid(),
  no               integer,
  design           text not null default 'Flyer',
  post_date        date not null,                 -- hari H tayang
  post_time        text default '17.00',
  post_topic       text,                          -- Event / Hari Raya / Promotion / ...
  project_name     text not null,                 -- "Type of Project", mis. "Selamat Hari Natal"
  visual_type      text,
  visual_link      text,
  asset_link       text,
  publish_channels text default 'WA, IG, Linkedin',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists timeline_post_topic_date_idx on public.timeline_post_topic (post_date);

alter table public.timeline_post_topic enable row level security;
drop policy if exists "timeline_post_topic authenticated read" on public.timeline_post_topic;
drop policy if exists "timeline_post_topic authenticated insert" on public.timeline_post_topic;
drop policy if exists "timeline_post_topic authenticated update" on public.timeline_post_topic;
drop policy if exists "timeline_post_topic authenticated delete" on public.timeline_post_topic;
create policy "timeline_post_topic authenticated read" on public.timeline_post_topic for select to authenticated using (true);
create policy "timeline_post_topic authenticated insert" on public.timeline_post_topic for insert to authenticated with check (true);
create policy "timeline_post_topic authenticated update" on public.timeline_post_topic for update to authenticated using (true);
create policy "timeline_post_topic authenticated delete" on public.timeline_post_topic for delete to authenticated using (true);

-- 2. Timeline Desain (sheet "Timeline Desain") ------------------------------
-- Excel punya dua kolom status: progres (Schedule/In Progress/Designed/Published)
-- dan approval (Review/Revisi/Approve/Done). Baris desain bisa terhubung ke post topic.
alter table public.timeline_desain add column if not exists approval_status text;
alter table public.timeline_desain
  add column if not exists post_topic_id uuid references public.timeline_post_topic (id) on delete set null;
alter table public.timeline_desain alter column status set default 'Schedule';
update public.timeline_desain set status = 'Schedule' where status = 'Pending';

create index if not exists timeline_desain_dates_idx on public.timeline_desain (date, due_date);
create index if not exists timeline_desain_post_topic_idx on public.timeline_desain (post_topic_id);

-- updated_at otomatis
create or replace function public.set_timeline_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists timeline_desain_updated_at on public.timeline_desain;
create trigger timeline_desain_updated_at before update on public.timeline_desain
  for each row execute function public.set_timeline_updated_at();

drop trigger if exists timeline_post_topic_updated_at on public.timeline_post_topic;
create trigger timeline_post_topic_updated_at before update on public.timeline_post_topic
  for each row execute function public.set_timeline_updated_at();

notify pgrst, 'reload schema';
