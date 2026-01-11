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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Tipe Data
interface FileItem {
  name: string;
  url: string;
}

interface PermintaanDetail {
  id: string;
  judul: string;
  deskripsi: string;
  project: string;
  status: string;
  due_date: string;
  created_at: string;
  admin?: string;
  admin_data?: { name: string; email: string; role: string };
  files?: FileItem[] | null; // Kolom file
}

export default function DetailPermintaanPage() {
  const params = useParams();
  const router = useRouter();
  const s = createClient();
  const id = params.id as string;

  const [data, setData] = useState<PermintaanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

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

      // Ambil data desainer (admin) lengkap
      let adminInfo = null;
      if (requestData.admin) {
        // Ganti 'users' dengan 'user_profiles' jika itu nama tabel yang benar di DB Anda
        const { data: adminProfile } = await s
          .from("user_profiles")
          .select("name, email, role")
          .eq("id", requestData.admin)
          .single();
        if (adminProfile) adminInfo = adminProfile;
      }

      setData({
        ...requestData,
        admin_data: adminInfo || undefined,
      });
      setLoading(false);
    }

    if (id) fetchData();
  }, [id, s, router]);

  // Handler: Download File
  const handleDownloadFile = async (file: FileItem) => {
    try {
      // Buka di tab baru (cara paling aman dan cepat)
      window.open(file.url, "_blank");
    } catch (error) {
      toast.error("Gagal membuka file.");
    }
  };

  // Handler: Terima Hasil
  const handleAccept = async () => {
    if (!confirm("Apakah Anda yakin hasil desain sudah sesuai?")) return;

    setIsSubmitting(true);
    const { error } = await s
      .from("permintaan")
      .update({ status: "DONE" })
      .eq("id", id);

    if (error) {
      toast.error("Gagal update status: " + error.message);
    } else {
      toast.success("Permintaan selesai! Terima kasih.");
      setData((prev) => (prev ? { ...prev, status: "DONE" } : null));
    }
    setIsSubmitting(false);
  };

  // Handler: Minta Revisi
  const handleRequestRevision = async () => {
    if (!revisionNote.trim()) {
      toast.warning("Mohon isi catatan revisi.");
      return;
    }

    setIsSubmitting(true);

    // Append catatan revisi ke deskripsi
    const oldDeskripsi = data?.deskripsi || "";
    const timeNow = new Date().toLocaleString("id-ID");
    const newDeskripsi = `${oldDeskripsi}\n\n[REVISI ${timeNow}]: ${revisionNote}`;

    const { error } = await s
      .from("permintaan")
      .update({
        status: "REVISION",
        deskripsi: newDeskripsi,
      })
      .eq("id", id);

    if (error) {
      toast.error("Gagal kirim revisi: " + error.message);
    } else {
      toast.success("Revisi terkirim ke desainer.");
      setData((prev) =>
        prev ? { ...prev, status: "REVISION", deskripsi: newDeskripsi } : null
      );
      setIsRevisionOpen(false);
    }
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "DONE") return <Badge className="bg-green-600">Selesai</Badge>;
    if (s === "PROGRESS")
      return <Badge variant="secondary">Sedang Dikerjakan</Badge>;
    if (s === "REVISION")
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-500">
          Perlu Revisi
        </Badge>
      );
    if (s === "REVIEW")
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700">
          Menunggu Review Anda
        </Badge>
      );
    return <Badge variant="outline">{status}</Badge>;
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

  const isReviewStatus = data.status?.toUpperCase() === "REVIEW";

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
        {/* Kolom Kiri: Detail & Files */}
        <div className="md:col-span-2 space-y-6">
          <div className="border rounded-lg p-6 bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">{data.judul}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Project: {data.project}
                </p>
              </div>
              {getStatusBadge(data.status)}
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold mb-2 block">
                Deskripsi & Brief
              </Label>
              <div className="prose dark:prose-invert max-w-none text-sm p-3 bg-muted/30 rounded-md whitespace-pre-wrap leading-relaxed">
                {data.deskripsi || "Tidak ada deskripsi."}
              </div>
            </div>

            {/* TABEL FILE LAMPIRAN (User Upload + Desainer Upload) */}
            <div>
              <Label className="text-base font-semibold mb-3 block">
                File Lampiran & Hasil Desain
              </Label>
              {data.files && data.files.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">No</TableHead>
                        <TableHead>Nama File</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.files.map((f, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell
                            className="font-medium truncate max-w-[200px]"
                            title={f.name}
                          >
                            {f.name}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadFile(f)}
                            >
                              <Download className="mr-2 h-4 w-4" /> Unduh
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center p-6 border border-dashed rounded-md text-muted-foreground text-sm">
                  Tidak ada file yang dilampirkan.
                </div>
              )}
            </div>
          </div>

          {/* AREA TINDAKAN: Muncul HANYA jika status REVIEW */}
          {isReviewStatus && (
            <div className="border rounded-lg p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Cek Hasil Desain
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Silakan unduh file di atas. Jika sudah sesuai klik "Selesai",
                  jika belum klik "Minta Revisi".
                </p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <Dialog open={isRevisionOpen} onOpenChange={setIsRevisionOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-blue-300 hover:bg-blue-100 dark:border-blue-700"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Revisi
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Catatan Revisi</DialogTitle>
                      <DialogDescription>
                        Jelaskan bagian yang perlu diperbaiki.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Isi Revisi</Label>
                      <Textarea
                        placeholder="Contoh: Warna terlalu gelap..."
                        value={revisionNote}
                        onChange={(e) => setRevisionNote(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="ghost"
                        onClick={() => setIsRevisionOpen(false)}
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={handleRequestRevision}
                        disabled={isSubmitting}
                      >
                        Kirim
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Selesai
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Info Project */}
        <div className="space-y-6">
          <div className="border rounded-lg p-5 bg-card shadow-sm space-y-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Info Project
            </h3>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="font-medium text-sm">
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
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Dibuat Pada</p>
                <p className="font-medium text-sm">
                  {new Date(data.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Desainer (PIC)</p>
                {data.admin_data ? (
                  <div className="mt-1">
                    <p className="font-medium text-sm">
                      {data.admin_data.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.admin_data.email}
                    </p>
                  </div>
                ) : (
                  <p className="font-medium text-sm text-orange-600">
                    Belum ditentukan
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Project</p>
                <p className="font-medium text-sm">{data.project}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Content>
  );
}
