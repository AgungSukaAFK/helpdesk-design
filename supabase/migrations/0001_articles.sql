-- =====================================================================
-- Fitur Artikel — tabel `articles` + storage bucket `articles`
-- Jalankan di Supabase SQL Editor (atau via supabase CLI).
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  title        text not null,
  slug         text not null unique,
  excerpt      text,
  content      text,                              -- HTML hasil editor Tiptap
  cover_image  text,                              -- path di storage bucket 'articles'
  tags         text[] not null default '{}',
  status       text not null default 'draft'      -- draft | published | archived
               check (status in ('draft', 'published', 'archived')),
  featured     boolean not null default false,
  author       uuid references public.users(id) on delete set null,
  published_at timestamptz,
  views        integer not null default 0
);

create index if not exists articles_status_idx       on public.articles (status);
create index if not exists articles_published_at_idx  on public.articles (published_at desc);
create index if not exists articles_tags_idx          on public.articles using gin (tags);

-- updated_at otomatis
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.articles enable row level security;

-- Publik (anon + authenticated) hanya boleh membaca artikel published
drop policy if exists "articles public read published" on public.articles;
create policy "articles public read published"
  on public.articles for select
  using (status = 'published');

-- Admin punya akses penuh (baca semua status, insert, update, delete)
drop policy if exists "articles admin all" on public.articles;
create policy "articles admin all"
  on public.articles for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------
-- RPC penghitung views (SECURITY DEFINER agar bisa dipanggil publik di bawah RLS)
-- ---------------------------------------------------------------------
create or replace function public.increment_article_views(article_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.articles
     set views = views + 1
   where slug = article_slug and status = 'published';
$$;

grant execute on function public.increment_article_views(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage bucket `articles` (public read) untuk cover & gambar inline
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('articles', 'articles', true)
on conflict (id) do nothing;

-- Siapa pun boleh membaca file di bucket articles
drop policy if exists "articles bucket public read" on storage.objects;
create policy "articles bucket public read"
  on storage.objects for select
  using (bucket_id = 'articles');

-- Hanya admin yang boleh upload / hapus
drop policy if exists "articles bucket admin write" on storage.objects;
create policy "articles bucket admin write"
  on storage.objects for all
  using (
    bucket_id = 'articles'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  )
  with check (
    bucket_id = 'articles'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );
