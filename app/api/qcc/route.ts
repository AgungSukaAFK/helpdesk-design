import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { bacaRentang, buatLaporan } from "@/lib/qcc/data";
import { daftarSlide } from "@/lib/qcc/deck";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedContext(["admin", "designer"]);
  if (auth.response) return auth.response;

  const rentang = bacaRentang(request.nextUrl.searchParams);
  if ("error" in rentang) return NextResponse.json({ error: rentang.error }, { status: 400 });

  try {
    const laporan = await buatLaporan(auth.client, rentang);
    return NextResponse.json({ ...laporan, slide: daftarSlide(laporan) });
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Gagal menghitung laporan QCC";
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
