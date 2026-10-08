-- Audit timeline & alur kerja permintaan desain.
-- - Kolom waktu per tahap (progress/review/revisi/selesai) + jumlah revisi
-- - Tabel permintaan_riwayat: log setiap perubahan status beserta pelaku & catatan
-- - Guard: hanya admin (atau API server/service role) yang boleh mengubah
--   status, PIC, rating, dan requester secara langsung.

alter table public.permintaan
  add column if not exists progress_at      timestamptz,
  add column if not exists review_at        timestamptz,
  add column if not exists revision_at      timestamptz,
  add column if not exists revision_count   integer not null default 0,
  add column if not exists done_at          timestamptz,
  add column if not exists updated_by       uuid references auth.users(id) on delete set null,
  add column if not exists last_status_note text;

create table if not exists public.permintaan_riwayat (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  permintaan_id  uuid not null references public.permintaan(id) on delete cascade,
  status_from    text,
  status_to      text not null,
  changed_by     uuid references public.user_profiles(id) on delete set null,
  catatan        text
);

create index if not exists permintaan_riwayat_permintaan_idx
  on public.permintaan_riwayat (permintaan_id, created_at);

alter table public.permintaan_riwayat enable row level security;

drop policy if exists "permintaan riwayat read related" on public.permintaan_riwayat;
create policy "permintaan riwayat read related"
  on public.permintaan_riwayat for select to authenticated
  using (
    exists (
      select 1 from public.permintaan p
      where p.id = permintaan_id
        and (
          p.requester = auth.uid()
          or p.admin = auth.uid()
          or exists (
            select 1 from public.user_profiles up
            where up.id = auth.uid() and up.role in ('admin', 'designer')
          )
        )
    )
  );
-- Insert hanya lewat trigger (security definer), tidak ada policy insert.

-- BEFORE: isi kolom waktu tiap tahap & jaga field sensitif
create or replace function public.permintaan_track_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  -- Request langsung dari client (auth.uid() terisi): catat pelaku & guard field
  if auth.uid() is not null then
    new.updated_by := auth.uid();

    if tg_op = 'UPDATE' then
      select exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role = 'admin'
      ) into is_admin;

      if not is_admin and (
        new.status is distinct from old.status
        or new.admin is distinct from old.admin
        or new.requester is distinct from old.requester
        or new.rating is distinct from old.rating
        or new.review is distinct from old.review
        or new.revision_count is distinct from old.revision_count
      ) then
        raise exception 'Perubahan status/PIC/rating hanya dapat dilakukan melalui alur kerja aplikasi';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    -- Catatan hanya berlaku untuk perubahan status yang menyertakannya
    if tg_op = 'UPDATE' and new.last_status_note is not distinct from old.last_status_note then
      new.last_status_note := null;
    end if;

    case new.status
      when 'PROGRESS' then new.progress_at := coalesce(new.progress_at, now());
      when 'REVIEW' then
        new.progress_at := coalesce(new.progress_at, now());
        new.review_at := now();
      when 'REVISION' then
        new.revision_at := now();
        new.revision_count := coalesce(new.revision_count, 0) + 1;
      when 'DONE' then
        new.done_at := case when tg_op = 'INSERT'
                            then coalesce(new.done_at, new.updated_at, now())
                            else now() end;
      else null;
    end case;

    -- Dibuka kembali dari DONE: waktu selesai lama tidak berlaku lagi
    if tg_op = 'UPDATE' and old.status = 'DONE' and new.status <> 'DONE' then
      new.done_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists permintaan_track_status_trg on public.permintaan;
create trigger permintaan_track_status_trg
  before insert or update on public.permintaan
  for each row execute function public.permintaan_track_status();

-- AFTER: tulis log riwayat
create or replace function public.permintaan_log_riwayat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.permintaan_riwayat (permintaan_id, created_at, status_from, status_to, changed_by, catatan)
    values (new.id, new.created_at, null, new.status, coalesce(new.updated_by, new.requester), new.last_status_note);
  elsif new.status is distinct from old.status then
    insert into public.permintaan_riwayat (permintaan_id, status_from, status_to, changed_by, catatan)
    values (new.id, old.status, new.status, new.updated_by, new.last_status_note);
  end if;
  return null;
end;
$$;

drop trigger if exists permintaan_log_riwayat_trg on public.permintaan;
create trigger permintaan_log_riwayat_trg
  after insert or update on public.permintaan
  for each row execute function public.permintaan_log_riwayat();

-- ===== Backfill data lama =====

-- Riwayat "dibuat"
insert into public.permintaan_riwayat (permintaan_id, created_at, status_from, status_to, changed_by)
select p.id, p.created_at, null, 'TO DO', up.id
from public.permintaan p
left join public.user_profiles up on up.id = p.requester
where not exists (select 1 from public.permintaan_riwayat r where r.permintaan_id = p.id);

-- Revisi lama tercatat sebagai pesan sistem di komentar
insert into public.permintaan_riwayat (permintaan_id, created_at, status_from, status_to, changed_by, catatan)
select k.permintaan_id, k.created_at, null, 'REVISION', k.user_id,
       nullif(trim(both '"' from regexp_replace(k.message, '^\[SYSTEM\] Mengirim permintaan REVISI:\s*', '')), '')
from public.komentar k
where k.message like '[SYSTEM] Mengirim permintaan REVISI%'
  and not exists (
    select 1 from public.permintaan_riwayat r
    where r.permintaan_id = k.permintaan_id and r.status_to = 'REVISION' and r.created_at = k.created_at
  );

-- Kolom waktu (perkiraan terbaik dari data yang ada). Trigger dimatikan sementara
-- agar updated_at lama tidak tertimpa now() dan sinkron daily activity tidak jalan.
alter table public.permintaan disable trigger user;

update public.permintaan p
set revision_count = coalesce(rv.cnt, 0),
    revision_at    = rv.last_at,
    done_at        = case when p.status = 'DONE' then coalesce(p.done_at, p.updated_at) else p.done_at end,
    review_at      = case when p.status = 'REVIEW' then coalesce(p.review_at, p.updated_at) else p.review_at end,
    progress_at    = case when p.status in ('PROGRESS', 'REVIEW', 'REVISION', 'DONE')
                          then coalesce(p.progress_at, p.updated_at) else p.progress_at end
from (
  select p2.id, count(r.id) as cnt, max(r.created_at) as last_at
  from public.permintaan p2
  left join public.permintaan_riwayat r on r.permintaan_id = p2.id and r.status_to = 'REVISION'
  group by p2.id
) rv
where rv.id = p.id;

alter table public.permintaan enable trigger user;

-- Riwayat "selesai" untuk tiket DONE lama
insert into public.permintaan_riwayat (permintaan_id, created_at, status_from, status_to, changed_by)
select p.id, p.done_at, null, 'DONE', null
from public.permintaan p
where p.status = 'DONE' and p.done_at is not null
  and not exists (
    select 1 from public.permintaan_riwayat r
    where r.permintaan_id = p.id and r.status_to = 'DONE'
  );
