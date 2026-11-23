create table if not exists public.timeline_desain (
  id uuid primary key default gen_random_uuid(),
  no integer,
  design text not null,
  status text not null default 'Pending',
  date date,
  due_date date,
  type_of_project text,
  layout_ukuran text,
  visual_type text,
  visual_link text,
  asset_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.timeline_desain enable row level security;
create policy "timeline_desain authenticated read" on public.timeline_desain for select to authenticated using (true);
create policy "timeline_desain authenticated insert" on public.timeline_desain for insert to authenticated with check (true);
create policy "timeline_desain authenticated update" on public.timeline_desain for update to authenticated using (true);
create policy "timeline_desain authenticated delete" on public.timeline_desain for delete to authenticated using (true);
notify pgrst, 'reload schema';
