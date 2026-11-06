import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { bacaRentang, buatLaporan } from "@/lib/qcc/data";
import { buatPpt } from "@/lib/qcc/deck";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedContext(["admin", "designer"]);
  if (auth.response) return auth.response;

  const params = request.nextUrl.searchParams;
  const rentang = bacaRentang(params);
  if ("error" in rentang) return NextResponse.json({ error: rentang.error }, { status: 400 });

  try {
    const laporan = await buatLaporan(auth.client, rentang);
    const tanpa = (params.get("tanpa") ?? "").split(",").filter(Boolean);
    const file = await buatPpt(laporan, tanpa);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="Laporan-QCC-${rentang.mulai}_${rentang.selesai}.pptx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Gagal membuat PPT";
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
