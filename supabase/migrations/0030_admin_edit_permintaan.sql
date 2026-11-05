-- Edit Lanjutan permintaan desain oleh admin departemen IT: mengubah timeline
-- (waktu, urutan, tambah/hapus entri) dan field yang biasanya terkunci.
--
-- Trigger status di bawah menganggap setiap perubahan status terjadi "sekarang"
-- (mengisi waktu tahap dengan now() dan menulis entri riwayat baru), jadi harus
-- dilewati saat timeline ditulis ulang. Sinkron daily activity tetap berjalan.

drop trigger if exists permintaan_track_status_trg on public.permintaan;
create trigger permintaan_track_status_trg
  before insert or update on public.permintaan
  for each row
  when (coalesce(current_setting('app.permintaan_admin_edit', true), '') <> 'on')
  execute function public.permintaan_track_status();

drop trigger if exists permintaan_log_riwayat_trg on public.permintaan;
create trigger permintaan_log_riwayat_trg
  after insert or update on public.permintaan
  for each row
  when (coalesce(current_setting('app.permintaan_admin_edit', true), '') <> 'on')
  execute function public.permintaan_log_riwayat();

-- Satu transaksi: tiket, riwayat, dan pesan sistem berubah bersama atau tidak sama sekali.
-- Otorisasi & validasi ada di API (/api/permintaan/[id]/edit-lanjutan).
create or replace function public.admin_edit_permintaan(
  p_id uuid,
  p_actor uuid,
  p_expected_updated_at timestamptz,
  p_fields jsonb,
  p_timeline jsonb,
  p_log text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_updated_at timestamptz;
begin
  select updated_at into current_updated_at
  from public.permintaan
  where id = p_id
  for update;

  if not found then
    raise exception 'Data permintaan tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Tiket berubah sejak form dibuka (mis. desainer menekan tombol alur kerja):
  -- menulis ulang timeline akan menghapus perubahan itu.
  if current_updated_at is distinct from p_expected_updated_at then
    raise exception 'Permintaan sudah berubah sejak form dibuka' using errcode = 'HD409';
  end if;

  -- Berlaku sampai transaksi ini selesai.
  perform set_config('app.permintaan_admin_edit', 'on', true);

  update public.permintaan
  set created_at     = (p_fields->>'created_at')::timestamptz,
      due_date       = (p_fields->>'due_date')::timestamptz,
      requester      = (p_fields->>'requester')::uuid,
      status         = p_fields->>'status',
      progress_at    = (p_fields->>'progress_at')::timestamptz,
      review_at      = (p_fields->>'review_at')::timestamptz,
      revision_at    = (p_fields->>'revision_at')::timestamptz,
      revision_count = (p_fields->>'revision_count')::integer,
      done_at        = (p_fields->>'done_at')::timestamptz,
      rating         = (p_fields->>'rating')::integer,
      review         = p_fields->>'review',
      updated_by     = p_actor
  where id = p_id;

  delete from public.permintaan_riwayat where permintaan_id = p_id;

  insert into public.permintaan_riwayat
    (permintaan_id, created_at, status_from, status_to, changed_by, catatan)
  select p_id, t.created_at, t.status_from, t.status_to, t.changed_by, t.catatan
  from jsonb_to_recordset(p_timeline) as t(
    created_at timestamptz,
    status_from text,
    status_to text,
    changed_by uuid,
    catatan text
  );

  insert into public.komentar (permintaan_id, user_id, message)
  values (p_id, p_actor, p_log);
end;
$$;

revoke all on function public.admin_edit_permintaan(uuid, uuid, timestamptz, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.admin_edit_permintaan(uuid, uuid, timestamptz, jsonb, jsonb, text)
  to service_role;

notify pgrst, 'reload schema';
