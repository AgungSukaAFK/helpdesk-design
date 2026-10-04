create table if not exists public.master_perusahaan (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.master_lokasi (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.master_departemen (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.master_perusahaan enable row level security;
alter table public.master_lokasi enable row level security;
alter table public.master_departemen enable row level security;

-- Create policies for read access for authenticated users
create policy "master_perusahaan select for authenticated" on public.master_perusahaan for select to authenticated using (true);
create policy "master_lokasi select for authenticated" on public.master_lokasi for select to authenticated using (true);
create policy "master_departemen select for authenticated" on public.master_departemen for select to authenticated using (true);

-- Insert Data for Perusahaan
insert into public.master_perusahaan (nama) values 
  ('PT. Global Inti Sejati'),
  ('PT. Garuda Mart Indonesia')
on conflict (nama) do nothing;

-- Insert Data for Lokasi
insert into public.master_lokasi (nama) values 
  ('GIS HO'),
  ('GIS BPN'),
  ('GIS J5'),
  ('GIS KM8'),
  ('GMI BPN'),
  ('GMI J5'),
  ('GMI KM10'),
  ('GMI KM8'),
  ('GMI Site'),
  ('Branch Tanjung Enim')
on conflict (nama) do nothing;

-- Insert Data for Departemen
insert into public.master_departemen (nama) values 
  ('HSE'),
  ('Legal'),
  ('HR'),
  ('GA'),
  ('IT'),
  ('SCM'),
  ('MARKETING'),
  ('RND'),
  ('PABRIKASI'),
  ('SERVICE')
on conflict (nama) do nothing;

notify pgrst, 'reload schema';
