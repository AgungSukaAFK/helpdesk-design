/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import { kolomEfektif, normalisasiGambar, type GambarHasil } from "@/lib/dokumen-desain";

// Lembar Dokumen Form Desain (A4 landscape) dengan title block seperti
// "referensi dokumen.jpeg": hasil desain di area atas, kolom No. Document,
// Project/Tipe/Description, Designer + Sign, kolom Acknowledge, dan blok
// Approval (User/Department/Sign) di kanan. Selalu hitam-putih seperti kertas.

export interface TtdLembar {
  id: string;
  peran: "designer" | "acknowledge" | "approval" | string;
  nama: string;
  jabatan?: string | null;
  status: string;
  ttd_url?: string | null;
  signed_at?: string | null;
}

export interface DataLembar {
  no_dokumen: string;
  no_dokumen_sub?: string | null;
  project_design: string;
  tipe_design: string;
  deskripsi: string;
  /** yyyy-mm-dd */
  tanggal_dokumen?: string | null;
  hasil_files: GambarHasil[];
  /** Jumlah kolom grid hasil; null = otomatis. */
  hasil_kolom?: number | null;
  ttd: TtdLembar[];
}

const tgl = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "";

const B = "border border-black";

/** Tanggal kalender (yyyy-mm-dd) tanpa geser zona waktu, mis. "12 November 2026". */
const tglPanjang = (ymd?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || "");
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/** Isi kotak tanda tangan sesuai status. */
function KotakTtd({ t, className }: { t?: TtdLembar; className?: string }) {
  if (!t) return <div className={className} />;
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {t.status === "DISETUJUI" && t.ttd_url ? (
        <img src={t.ttd_url} alt={`Tanda tangan ${t.nama}`} className="max-h-full max-w-full object-contain" />
      ) : t.status === "DITOLAK" ? (
        <span className="rotate-[-8deg] rounded border-2 border-red-600 px-1.5 text-[10px] font-bold tracking-wider text-red-600">
          DITOLAK
        </span>
      ) : (
        <span className="text-[9px] italic text-neutral-400 print:hidden">menunggu</span>
      )}
      {t.status !== "MENUNGGU" && t.signed_at && (
        <span className="absolute bottom-0 right-0.5 text-[7px] leading-none text-neutral-500">{tgl(t.signed_at)}</span>
      )}
    </div>
  );
}

export function LembarDokumen({ data, className }: { data: DataLembar; className?: string }) {
  const designer = data.ttd.find((t) => t.peran === "designer");
  const acknowledge = data.ttd.filter((t) => t.peran === "acknowledge");
  const approval = data.ttd.filter((t) => t.peran === "approval");

  return (
    <div
      id="lembar-dokumen-desain"
      className={cn(
        "relative mx-auto flex aspect-[297/210] w-full min-w-[960px] flex-col bg-white p-[1.4%] font-[Arial,Helvetica,sans-serif] text-black shadow-sm",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col border-2 border-black">
        {/* Kop: logo kiri, tanggal dokumen kanan */}
        <div className="flex h-[58px] shrink-0 items-center justify-between px-3 pt-2">
          <img src="/lourdes.png" alt="Lourdes Auto Parts" className="h-full w-auto object-contain" />
          <div className="text-right text-[12px] leading-tight">
            <div className="text-[9px] text-neutral-600">Tanggal</div>
            <div className="font-semibold">{tglPanjang(data.tanggal_dokumen) || "-"}</div>
          </div>
        </div>

      <div className="flex min-h-0 flex-1">
        {/* Kolom kiri: hasil desain + title block */}
        <div className="flex min-w-0 flex-1 flex-col">
          <HasilDesain files={data.hasil_files} kolom={data.hasil_kolom} />

          <table className="w-full table-fixed border-collapse text-[11px] leading-tight">
            <colgroup>
              <col style={{ width: "18%" }} />
              <col />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              {acknowledge.map((a) => (
                <col key={a.id} style={{ width: "11%" }} />
              ))}
            </colgroup>
            <tbody>
              <tr className="h-[26px]">
                <td rowSpan={2} className="border-r border-black" />
                <td rowSpan={2} className={cn(B, "align-top px-1.5 py-1")}>
                  <div className="text-[10px]">Project Design:</div>
                  <div className="mt-1 text-[13px]">{data.project_design}</div>
                </td>
                <td rowSpan={2} colSpan={2} className={cn(B, "align-top px-1.5 py-1")}>
                  <div className="text-[10px]">Tipe Design:</div>
                  <div className="mt-1 text-[13px]">{data.tipe_design}</div>
                </td>
                {acknowledge.map((a) => (
                  <td key={a.id} className={cn(B, "text-center text-[10px]")}>
                    Acknowledge
                  </td>
                ))}
              </tr>
              <tr className="h-[24px]">
                {acknowledge.map((a) => (
                  <td key={a.id} rowSpan={2} className={cn(B, "p-0 align-top")}>
                    <div className="flex h-[70px] flex-col">
                      <KotakTtd t={a} className="min-h-0 flex-1 px-1 pt-1" />
                      <div className="truncate px-1 text-center text-[11px] font-semibold">{a.nama}</div>
                      <div className="mx-2 truncate border-t border-black pb-0.5 text-center text-[9px]">
                        {a.jabatan || " "}
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="h-[46px]">
                <td className={cn(B, "align-top px-1.5 py-1")}>
                  <div className="text-[9px]">No. Document:</div>
                  <div className="text-[11px]">{data.no_dokumen}</div>
                  {data.no_dokumen_sub && <div className="text-[8px]">{data.no_dokumen_sub}</div>}
                </td>
                <td className={cn(B, "align-top px-1.5 py-1")}>
                  <div className="text-[9px]">Description:</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px]">{data.deskripsi}</div>
                </td>
                <td className={cn(B, "align-top px-1.5 py-1")}>
                  <div className="text-[9px]">Designer:</div>
                  <div className="mt-0.5 truncate text-[11px]">{designer?.nama ?? "-"}</div>
                </td>
                <td className={cn(B, "p-0 align-top")}>
                  <div className="px-1.5 pt-1 text-[9px]">Sign:</div>
                  <KotakTtd t={designer} className="h-[30px] px-1" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Kolom kanan: blok Approval */}
        <div className="flex w-[25%] flex-col justify-end">
          <table className="w-full table-fixed border-collapse text-[11px] leading-tight">
            <colgroup>
              <col style={{ width: "57%" }} />
              <col />
            </colgroup>
            <tbody>
              <tr className="h-[30px]">
                <td colSpan={2} className={cn(B, "text-center text-[15px]")}>
                  Approval
                </td>
              </tr>
              <tr className="h-[26px]">
                <td className={cn(B, "px-1.5 text-[12px]")}>User</td>
                <td className={cn(B, "text-center text-[12px]")}>Sign</td>
              </tr>
              {approval.map((a) => (
                <ApprovalRows key={a.id} a={a} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}

const JUSTIFY = { kiri: "justify-start", tengah: "justify-center", kanan: "justify-end" } as const;
const POSISI_X = { kiri: "left", tengah: "center", kanan: "right" } as const;

/**
 * Grid gambar hasil. Tiap gambar menempati lebar x tinggi sel grid, dan isi
 * kotaknya diskalakan (object-contain) sesuai persen skala. Baris dibagi rata
 * mengisi ruang di atas title block; grid-auto-flow dense menambal celah.
 */
export function HasilDesain({ files, kolom }: { files: GambarHasil[]; kolom?: number | null }) {
  if (files.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-neutral-400">
        Belum ada hasil desain
      </div>
    );
  }
  const list = files.map(normalisasiGambar);
  const jumlahKolom = kolomEfektif(kolom, list);
  return (
    <div
      className="grid min-h-0 flex-1 gap-3 p-3"
      style={{
        gridTemplateColumns: `repeat(${jumlahKolom}, minmax(0, 1fr))`,
        gridAutoRows: "minmax(0, 1fr)",
        gridAutoFlow: "row dense",
      }}
    >
      {list.map((f, i) => (
        <figure
          key={`${i}-${f.url}`}
          className="m-0 flex min-h-0 min-w-0 flex-col"
          style={{
            gridColumn: `span ${Math.min(f.lebar, jumlahKolom)}`,
            gridRow: `span ${f.tinggi}`,
          }}
        >
          {/* Ada caption: gambar menempel ke bawah supaya caption tepat di bawahnya */}
          <div
            className={cn("flex min-h-0 flex-1", JUSTIFY[f.rata], f.caption ? "items-end" : "items-center")}
          >
            <img
              src={f.url}
              alt={f.caption || f.name}
              className="object-contain"
              style={{
                width: `${f.skala}%`,
                height: `${f.skala}%`,
                objectPosition: `${POSISI_X[f.rata]} ${f.caption ? "bottom" : "center"}`,
              }}
            />
          </div>
          {f.caption && (
            <figcaption className={cn("shrink-0 pt-1 text-[11px] font-semibold", {
              "text-left": f.rata === "kiri",
              "text-center": f.rata === "tengah",
              "text-right": f.rata === "kanan",
            })}>
              {f.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

function ApprovalRows({ a }: { a: TtdLembar }) {
  return (
    <>
      <tr className="h-[50px]">
        <td className={cn(B, "align-bottom px-1.5 pb-0.5 font-semibold")}>{a.nama}</td>
        <td rowSpan={3} className={cn(B, "p-1")}>
          <KotakTtd t={a} className="h-[100px]" />
        </td>
      </tr>
      <tr className="h-[26px]">
        <td className={cn(B, "px-1.5 text-[12px]")}>Department</td>
      </tr>
      <tr className="h-[42px]">
        <td className={cn(B, "px-1.5 align-middle text-[11px] leading-snug")}>{a.jabatan || "-"}</td>
      </tr>
    </>
  );
}
