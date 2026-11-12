"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { BastForm, type NilaiAwalBast } from "@/components/bast/bast-form";

export default function EditBastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [nilai, setNilai] = useState<NilaiAwalBast | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bast/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat BAST");
        if (!json.akses.edit) {
          setPesan("BAST ini tidak dapat diubah (sudah diterima atau Anda bukan pengelolanya).");
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
      title="Ubah BAST"
      cardAction={
        <Button variant="outline" asChild>
          <Link href={`/bast/${id}`}>
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
        <BastForm bastId={id} nilaiAwal={nilai} />
      )}
    </Content>
  );
}
