"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { DokumenForm, type NilaiAwalDokumen } from "@/components/dokumen-desain/dokumen-form";

export default function EditDokumenDesainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [nilai, setNilai] = useState<NilaiAwalDokumen | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/dokumen-desain/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat dokumen");
        if (!json.akses.edit) {
          setPesan("Dokumen ini tidak dapat diubah (sudah disetujui atau Anda bukan pembuatnya).");
          return;
        }
        setNilai(json.data);
      })
      .catch((e) => {
        toast.error(e.message);
        setPesan(e.message);
      });
  }, [id]);

  return (
    <Content
      title="Revisi Dokumen Form Desain"
      cardAction={
        <Button variant="outline" asChild>
          <Link href={`/dokumen-desain/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Link>
        </Button>
      }
    >
      {pesan ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{pesan}</p>
      ) : !nilai ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DokumenForm dokumenId={id} nilaiAwal={nilai} />
      )}
    </Content>
  );
}
