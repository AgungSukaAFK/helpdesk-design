import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { BastForm } from "@/components/bast/bast-form";

export default async function BuatBastPage({
  searchParams,
}: {
  searchParams: Promise<{ permintaan?: string }>;
}) {
  const { permintaan } = await searchParams;
  return (
    <Content
      title="Buat BAST"
      description="Pilih jenis, isi barang yang diserahkan dan penerimanya. Nomor & isian bawaan terisi otomatis dari jenis."
      cardAction={
        <Button variant="outline" asChild>
          <Link href="/bast">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Link>
        </Button>
      }
    >
      <BastForm permintaanAwal={permintaan ?? null} />
    </Content>
  );
}
