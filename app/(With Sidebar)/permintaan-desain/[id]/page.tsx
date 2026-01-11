"use client";

import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RotateCcw,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Definisikan tipe data sesuai database Anda
interface PermintaanDetail {
  id: string;
  judul: string;
  deskripsi: string;
  project: string;
  status: "PROGRESS" | "REVISION" | "REVIEW" | "DONE";
  due_date: string;
  created_at: string;
  catatan_revisi?: string; // Asumsi ada kolom ini untuk log revisi terakhir
  admin?: string;
  admin_data?: { name: string }; // Untuk join nama admin
}

export default function DetailPermintaanPage() {
  const params = useParams();
  const router = useRouter();
  const s = createClient();
  const id = params.id as string;

  const [data, setData] = useState<PermintaanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk dialog revisi
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // 1. Ambil data permintaan
      const { data: requestData, error } = await s
        .from("permintaan")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        toast.error("Gagal memuat detail: " + error.message);
        router.push("/permintaan-desain");
        return;
      }

      // 2. Jika ada admin (desainer), ambil namanya
      let adminName = "-";
      if (requestData.admin) {
        const { data: adminProfile } = await s
          .from("user_profiles")
          .select("name")
          .eq("id", requestData.admin)
          .single();
        if (adminProfile) adminName = adminProfile.name;
      }

      setData({
        ...requestData,
        admin_data: { name: adminName },
      });
      setLoading(false);
    }

    if (id) fetchData();
  }, [id, s, router]);

  // Handler: Terima Hasil (Selesai)
  const handleAccept = async () => {
    if (!confirm("Apakah Anda yakin ingin menyelesaikan permintaan ini?"))
      return;

    setIsSubmitting(true);
    const { error } = await s
      .from("permintaan")
      .update({ status: "DONE" })
      .eq("id", id);

    if (error) {
      toast.error("Gagal memperbarui status: " + error.message);
    } else {
      toast.success("Permintaan selesai! Terima kasih.");
      // Update state lokal agar UI berubah langsung
      setData((prev) => (prev ? { ...prev, status: "DONE" } : null));
    }
    setIsSubmitting(false);
  };

  // Handler: Minta Revisi
  // Handler: Minta Revisi (Versi Tanpa Kolom Tambahan)
  const handleRequestRevision = async () => {
    if (!revisionNote.trim()) {
      toast.warning("Mohon isi catatan revisi agar desainer paham.");
      return;
    }

    setIsSubmitting(true);

    // Kita ambil deskripsi lama, lalu tambahkan catatan revisi baru di bawahnya
    const oldDeskripsi = data?.deskripsi || "";
    const timeNow = new Date().toLocaleString("id-ID");
    const newDeskripsi = `${oldDeskripsi}\n\n[REVISI ${timeNow}]: ${revisionNote}`;

    const { error } = await s
      .from("permintaan")
      .update({
        status: "REVISION",
        deskripsi: newDeskripsi, // Simpan ke deskripsi
      })
      .eq("id", id);

    if (error) {
      toast.error("Gagal mengirim revisi: " + error.message);
    } else {
      toast.success("Permintaan revisi berhasil dikirim.");
      setData((prev) =>
        prev ? { ...prev, status: "REVISION", deskripsi: newDeskripsi } : null
      );
      setIsRevisionOpen(false);
    }
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DONE":
        return <Badge className="bg-green-600">Selesai</Badge>;
      case "PROGRESS":
        return <Badge variant="secondary">Sedang Dikerjakan</Badge>;
      case "REVISION":
        return (
          <Badge
            variant="outline"
            className="border-orange-500 text-orange-500"
          >
            Perlu Revisi
          </Badge>
        );
      case "REVIEW":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700">
            Menunggu Review Anda
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Content title="Detail Permintaan" size="lg">
        <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Memuat detail...
        </div>
      </Content>
    );
  }

  if (!data) return null;

  return (
    <Content
      title="Detail Permintaan Desain"
      size="lg"
      cardAction={
        <Button variant="outline" asChild>
          <Link href="/permintaan-desain">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-3">
        {/* Kolom Kiri: Informasi Utama */}
        <div className="md:col-span-2 space-y-6">
          <div className="border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{data.judul}</h2>
              {getStatusBadge(data.status)}
            </div>

            <div className="prose dark:prose-invert max-w-none">
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Deskripsi & Brief
              </h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {data.deskripsi || "Tidak ada deskripsi."}
              </p>
            </div>

            {/* Bagian Catatan Revisi (Jika ada) */}
            {data.catatan_revisi && (
              <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md">
                <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-1 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Catatan Revisi Terakhir
                </h4>
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  {data.catatan_revisi}
                </p>
              </div>
            )}
          </div>

          {/* AREA TINDAKAN: Muncul HANYA jika status REVIEW */}
          {data.status === "REVIEW" && (
            <div className="border rounded-lg p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Konfirmasi Hasil Desain
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Desainer telah menyelesaikan pekerjaan. Silakan cek hasil,
                  lalu tentukan langkah selanjutnya.
                </p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                {/* Tombol Revisi */}
                <Dialog open={isRevisionOpen} onOpenChange={setIsRevisionOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 md:flex-none border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Minta Revisi
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Permintaan Revisi</DialogTitle>
                      <DialogDescription>
                        Berikan catatan yang jelas kepada desainer mengenai apa
                        yang perlu diperbaiki.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="note">Catatan Revisi</Label>
                        <Textarea
                          id="note"
                          placeholder="Contoh: Tolong ganti warna background jadi biru, dan font judul diperbesar..."
                          value={revisionNote}
                          onChange={(e) => setRevisionNote(e.target.value)}
                          rows={5}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsRevisionOpen(false)}
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={handleRequestRevision}
                        disabled={isSubmitting}
                      >
                        {isSubmitting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Kirim Revisi
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Tombol Selesai */}
                <Button
                  className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleAccept}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Terima / Selesai
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Meta Data */}
        <div className="space-y-6">
          <div className="border rounded-lg p-4 bg-card shadow-sm space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Informasi Project
            </h3>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Deadline (Due Date)
                </p>
                <p className="font-medium">
                  {new Date(data.due_date).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Tanggal Dibuat</p>
                <p className="font-medium">
                  {new Date(data.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Dikerjakan Oleh</p>
                <p className="font-medium">
                  {data.admin_data?.name || "Belum ditentukan"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Nama Project</p>
                <p className="font-medium">{data.project}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Content>
  );
}
