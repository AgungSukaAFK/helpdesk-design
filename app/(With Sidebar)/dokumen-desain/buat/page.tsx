import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { DokumenForm } from "@/components/dokumen-desain/dokumen-form";

export default async function BuatDokumenDesainPage({
  searchParams,
}: {
  searchParams: Promise<{ permintaan?: string }>;
}) {
  const { permintaan } = await searchParams;
  return (
    <Content
      title="Buat Dokumen Form Desain"
      description="Kaitkan ke permintaan desain & hasilnya, isi title block, lalu tentukan siapa saja yang harus tanda tangan."
      cardAction={
        <Button variant="outline" asChild>
          <Link href="/dokumen-desain">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Link>
        </Button>
      }
    >
      <DokumenForm permintaanAwal={permintaan ?? null} />
    </Content>
  );
}
