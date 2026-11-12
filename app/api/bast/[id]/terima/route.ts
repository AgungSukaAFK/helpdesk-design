import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { createNotifications, type NotificationRow } from "@/lib/notifications/server";
import {
  bolehBukaKembali,
  bolehTerimaAkun,
  bolehTerimaLangsung,
  bolehTerimaScan,
  MAKS_BUKTI,
  MAKS_BUKTI_BYTES,
  MAKS_SCAN_BYTES,
  type MetodeTerima,
} from "@/lib/bast";
import { catatRiwayatBast, muatBast, simpanTtdUser } from "@/lib/bast-server";
import { hapusFileTtd, namaPengguna, tampilNama, TTD_BUCKET } from "@/lib/dokumen-desain-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const EKSTENSI: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const teks = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Catat penerimaan barang (multipart/form-data):
 * - metode=langsung : nama, dept, ttd (PNG data URL) digambar penerima di perangkat penyerah
 * - metode=akun     : penerima yang punya akun; ttd / pakaiTersimpan / simpan, dept opsional
 * - metode=scan     : nama, dept, scan (gambar/PDF surat bertanda tangan basah)
 * Semua metode boleh menyertakan bukti (foto serah terima, maks. 4).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const diunggah: string[] = [];
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;
    const aktor = { id: user.id, role };

    const muat = await muatBast(client, id);
    if ("error" in muat) return NextResponse.json({ error: muat.error }, { status: muat.status });
    const { bast, permintaan } = muat;

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    const metode = teks(form.get("metode"), 10) as MetodeTerima;

    const boleh =
      metode === "langsung"
        ? bolehTerimaLangsung(bast, aktor)
        : metode === "akun"
          ? bolehTerimaAkun(bast, aktor)
          : metode === "scan"
            ? bolehTerimaScan(bast, aktor)
            : null;
    if (boleh === null) return NextResponse.json({ error: "Metode penerimaan tidak dikenal" }, { status: 400 });
    if (!boleh) {
      return NextResponse.json(
        {
          error:
            metode === "scan"
              ? "Anda tidak dapat mencatat penerimaan BAST ini."
              : "BAST belum ditandatangani penyerah atau tidak menunggu penerimaan dari Anda.",
        },
        { status: 403 },
      );
    }

    let nama = teks(form.get("nama"), 120);
    let dept = teks(form.get("dept"), 120);
    if (metode === "akun") {
      const { data: profil } = await client.from("user_profiles").select("name, email, departemen").eq("id", user.id).maybeSingle();
      nama = tampilNama(profil);
      dept = dept || profil?.departemen || bast.penerima_dept || "";
    }
    if (!nama) return NextResponse.json({ error: "Nama penerima wajib diisi." }, { status: 400 });
    if (!dept) return NextResponse.json({ error: "Departemen penerima wajib diisi." }, { status: 400 });

    const storage = client.storage.from(TTD_BUCKET);
    const stamp = Date.now();

    // Bukti foto (opsional)
    const buktiFiles = form.getAll("bukti").filter((f): f is File => typeof f !== "string" && f.size > 0);
    if (buktiFiles.length > MAKS_BUKTI) {
      return NextResponse.json({ error: `Maksimal ${MAKS_BUKTI} foto bukti.` }, { status: 400 });
    }
    for (const f of buktiFiles) {
      if (!f.type.startsWith("image/") || !EKSTENSI[f.type]) {
        return NextResponse.json({ error: `"${f.name}" harus berupa gambar JPG/PNG/WEBP.` }, { status: 400 });
      }
      if (f.size > MAKS_BUKTI_BYTES) {
        return NextResponse.json({ error: `"${f.name}" melebihi ${MAKS_BUKTI_BYTES / 1024 / 1024} MB.` }, { status: 400 });
      }
    }

    let penerimaTtdPath: string | null = null;
    let scanPath: string | null = null;
    let scanNama: string | null = null;

    if (metode === "scan") {
      const scan = form.get("scan");
      if (!scan || typeof scan === "string" || scan.size === 0) {
        return NextResponse.json({ error: "File scan surat wajib diunggah." }, { status: 400 });
      }
      const ext = EKSTENSI[scan.type];
      if (!ext) return NextResponse.json({ error: "Scan harus berupa PDF atau gambar JPG/PNG/WEBP." }, { status: 400 });
      if (scan.size > MAKS_SCAN_BYTES) {
        return NextResponse.json({ error: `Ukuran scan maksimal ${MAKS_SCAN_BYTES / 1024 / 1024} MB.` }, { status: 400 });
      }
      scanPath = `bast/${id}/scan-${stamp}.${ext}`;
      scanNama = scan.name.slice(0, 200) || `scan.${ext}`;
      const { error } = await storage.upload(scanPath, new Uint8Array(await scan.arrayBuffer()), { contentType: scan.type });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      diunggah.push(scanPath);
    } else {
      const hasil = await simpanTtdUser(client, user.id, `bast/${id}/penerima-${stamp}.png`, {
        ttd: form.get("ttd"),
        // TTD langsung milik penerima (bukan pemilik akun yang login), jadi tidak boleh
        // memakai atau menimpa TTD tersimpan di profil.
        pakaiTersimpan: metode === "akun" && form.get("pakaiTersimpan") === "1",
        simpan: metode === "akun" && form.get("simpan") === "1",
      });
      if ("error" in hasil) return NextResponse.json({ error: hasil.error }, { status: hasil.status });
      penerimaTtdPath = hasil.path;
      diunggah.push(hasil.path);
    }

    const buktiPaths: string[] = [];
    for (const [i, f] of buktiFiles.entries()) {
      const path = `bast/${id}/bukti-${stamp}-${i}.${EKSTENSI[f.type]}`;
      const { error } = await storage.upload(path, new Uint8Array(await f.arrayBuffer()), { contentType: f.type });
      if (error) {
        await hapusFileTtd(client, diunggah);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      diunggah.push(path);
      buktiPaths.push(path);
    }

    const sekarang = new Date().toISOString();
    const { data: diubah, error: updError } = await client
      .from("bast")
      .update({
        status: "DITERIMA",
        metode_terima: metode,
        penerima_nama: nama,
        penerima_dept: dept,
        penerima_ttd_path: penerimaTtdPath,
        penerima_signed_at: penerimaTtdPath ? sekarang : null,
        scan_path: scanPath,
        scan_nama: scanNama,
        bukti_paths: buktiPaths,
        diterima_at: sekarang,
        diterima_oleh: user.id,
      })
      .eq("id", id)
      .eq("status", "MENUNGGU")
      .select("id");
    if (updError || !diubah?.length) {
      await hapusFileTtd(client, diunggah);
      return NextResponse.json(
        { error: updError?.message || "BAST sudah diterima sebelumnya." },
        { status: updError ? 500 : 409 },
      );
    }

    await catatRiwayatBast(client, id, user.id, "DITERIMA", `${nama} (${dept}) — ${metode}`);

    const pencatat = tampilNama((await namaPengguna(client, [user.id])).get(user.id));
    const penerimaUntuk = new Set<string>([bast.created_by, bast.penyerah_id, ...permintaan.map((p) => p.requester)]);
    penerimaUntuk.delete(user.id);
    const notif: NotificationRow[] = Array.from(penerimaUntuk).map((uid) => ({
      user_id: uid,
      title: "BAST Diterima",
      message: `${bast.judul_barang.replace(/:$/, "")} sudah diterima ${nama} (${bast.penerima_instansi}).${
        metode === "akun" ? "" : ` Dicatat oleh ${pencatat}.`
      }`,
      link: `/bast/${id}`,
    }));
    if (notif.length) await createNotifications(client, notif, { actorId: user.id });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// Admin membuka kembali BAST yang sudah diterima (salah catat). Bukti penerimaan dihapus.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;

    const muat = await muatBast(client, id);
    if ("error" in muat) return NextResponse.json({ error: muat.error }, { status: muat.status });
    const { bast } = muat;
    if (!bolehBukaKembali(bast, { id: user.id, role })) {
      return NextResponse.json({ error: "BAST ini belum diterima." }, { status: 400 });
    }
    const alasan = (request.nextUrl.searchParams.get("alasan") || "").trim().slice(0, 500);

    const { error } = await client
      .from("bast")
      .update({
        status: "MENUNGGU",
        metode_terima: null,
        penerima_ttd_path: null,
        penerima_signed_at: null,
        scan_path: null,
        scan_nama: null,
        bukti_paths: [],
        diterima_at: null,
        diterima_oleh: null,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await hapusFileTtd(client, [
      bast.penerima_ttd_path,
      bast.scan_path,
      ...(Array.isArray(bast.bukti_paths) ? bast.bukti_paths : []),
    ]);
    await catatRiwayatBast(client, id, user.id, "DIBUKA_KEMBALI", alasan);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
