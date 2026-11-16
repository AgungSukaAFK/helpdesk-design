import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { buatPptRekap } from "@/lib/rekap-bulanan-deck";
import type { YearIntegratedRekap } from "@/lib/rekap-integrated";
import { GET as ambilRekap } from "../route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedContext(["admin"]);
  if (auth.response) return auth.response;

  const params = request.nextUrl.searchParams;
  const year = Number(params.get("year"));
  const bulan = params.get("month") ?? "";
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !/^(0[1-9]|1[0-2])$/.test(bulan)) {
    return NextResponse.json({ error: "Parameter year/month tidak valid" }, { status: 400 });
  }

  try {
    // Pakai perhitungan yang sama persis dengan halaman Rekap Bulanan
    const url = new URL(`/api/rekap-bulanan?year=${year}`, request.nextUrl.origin);
    const res = await ambilRekap(new NextRequest(url));
    const json = await res.json();
    if (!res.ok || !json.data) throw new Error(json.error || "Gagal memuat data rekap");

    const file = await buatPptRekap(json.data as YearIntegratedRekap, bulan);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="Rekap-Bulanan-${year}-${bulan}.pptx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Gagal membuat PPT";
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
