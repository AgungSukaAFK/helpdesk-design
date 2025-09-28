// app/permintaan/detail/[id]/page.tsx

"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PermintaanDesain } from "../buat/page";
import { format } from "date-fns";
import { id as indonesiaLocale } from "date-fns/locale";
import { toast } from "sonner";
import {
  Calendar,
  Download,
  Loader2,
  User,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

// Components UI
import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Interface
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Helper Component untuk Loading State
const LoadingState = () => (
  <Content
    title="Memuat Detail Permintaan..."
    description="Harap tunggu sebentar."
  >
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  </Content>
);

// Helper Component untuk Not Found State
const NotFoundState = ({ id }: { id: string }) => (
  <Content
    title="Data Tidak Ditemukan"
    description={`Permintaan desain dengan ID: ${id} tidak dapat ditemukan.`}
  />
);

export default function DetailPermintaanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const s = createClient();

  // State Management
  const [permin, setPermin] = useState<PermintaanDesain | null>(null);
  const [requester, setRequester] = useState<UserProfile | null>(null);
  const [admin, setAdmin] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // State untuk Dialog Interaktif
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [revisionNote, setRevisionNote] = useState("");

  // Data Fetching
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await s
      .from("permintaan")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      toast.error("Gagal mengambil data permintaan: " + error.message);
      setPermin(null);
    } else {
      setPermin(data as PermintaanDesain);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  useEffect(() => {
    async function fetchDataUser(userId: string, setUser: Function) {
      const { data } = await s
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) setUser(data);
    }
    if (permin?.requester) fetchDataUser(permin.requester, setRequester);
    if (permin?.admin) fetchDataUser(permin.admin, setAdmin);
  }, [permin]);

  // Handlers
  const handleRequestRevision = async () => {
    if (!revisionNote.trim()) {
      toast.warning("Harap isi catatan revisi.");
      return;
    }
    setIsSubmitting(true);
    const { error } = await s
      .from("permintaan")
      .update({
        status: "REVISION",
        review: `[Catatan Revisi]: ${revisionNote}`,
      })
      .eq("id", id);

    if (error) {
      toast.error("Gagal meminta revisi: " + error.message);
    } else {
      toast.success("Permintaan revisi berhasil dikirim.");
      await fetchData();
    }
    setIsSubmitting(false);
  };

  const handleCompleteRequest = async () => {
    if (rating === null) {
      toast.warning("Harap pilih rating antara 1-10.");
      return;
    }
    setIsSubmitting(true);
    const { error } = await s
      .from("permintaan")
      .update({ rating: rating, review: review })
      .eq("id", id);

    if (error) {
      toast.error("Gagal menyelesaikan permintaan: " + error.message);
    } else {
      toast.success("Terima kasih atas penilaian Anda!");
      await fetchData();
    }
    setIsSubmitting(false);
  };

  const handleDownloadFile = async (file: { name: string; url: string }) => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Gagal mengunduh file.");
    }
  };

  // Helper Functions
  const getStatusVariant = (
    status: PermintaanDesain["status"]
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "DONE":
        return "default";
      case "PROGRESS":
        return "secondary";
      case "REVISION":
        return "outline";
      default:
        return "secondary";
    }
  };

  // Render Logic
  if (loading) {
    return <LoadingState />;
  }

  if (!permin) {
    return <NotFoundState id={id} />;
  }

  return (
    <>
      <Content size="sm" title="Detail Permintaan Desain">
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Judul Permintaan</Label>
            <p>{permin.judul}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Departemen</Label>
            <p>{permin.departemen}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Status Permintaan</Label>
            <Badge variant={getStatusVariant(permin.status)}>
              {permin.status}
            </Badge>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Deskripsi</Label>
            <p className="max-h-52 overflow-auto whitespace-pre-wrap">
              {permin.deskripsi}
            </p>
          </div>
        </div>
      </Content>

      <Content size="sm" title="Informasi Tambahan">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 mt-1 text-muted-foreground" />
            <div>
              <Label>Peminta</Label>
              <div className="text-sm font-medium">
                <span className="mr-2">
                  <Badge variant={"outline"}>
                    {requester?.role || "Guest"}
                  </Badge>
                </span>
                {requester?.name || "Memuat..."}
              </div>
              <p className="text-sm text-muted-foreground">
                {requester?.email}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 mt-1 text-muted-foreground" />
            <div>
              <Label>Admin</Label>
              {admin ? (
                <>
                  <div className="text-sm font-medium">
                    <span className="mr-2">
                      <Badge variant={"outline"}>
                        {admin?.role || "Admin"}
                      </Badge>
                    </span>
                    {admin?.name || "Memuat..."}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {admin?.email}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada</p>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 mt-1 text-muted-foreground" />
            <div>
              <Label>Tanggal Dibuat</Label>
              <p className="text-sm font-medium">
                {format(new Date(permin.created_at), "dd MMMM yyyy", {
                  locale: indonesiaLocale,
                })}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 mt-1 text-red-500" />
            <div>
              <Label>Batas Waktu</Label>
              <p className="text-sm font-medium">
                {format(new Date(permin.due_date), "dd MMMM yyyy", {
                  locale: indonesiaLocale,
                })}
              </p>
            </div>
          </div>
        </div>
      </Content>

      {permin.files && permin.files.length > 0 && (
        <Content size="sm" title="File Terlampir">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama File</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permin.files.map((file, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {file.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadFile(file)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Unduh
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Content>
      )}

      {permin.status === "DONE" && permin.rating === "" && (
        <Content size="sm">
          <Card className="bg-secondary border-primary">
            <CardHeader>
              <CardTitle>Pekerjaan Selesai</CardTitle>
              <CardDescription>
                Admin telah menyelesaikan permintaan ini. Silakan berikan
                tanggapan Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" /> Minta Revisi
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Formulir Permintaan Revisi</DialogTitle>
                    <DialogDescription>
                      Jelaskan bagian mana yang perlu diperbaiki oleh admin.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Textarea
                      placeholder="Contoh: Tolong ubah warna logo menjadi biru..."
                      value={revisionNote}
                      onChange={(e) => setRevisionNote(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <DialogFooter>
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

              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <CheckCircle className="mr-2 h-4 w-4" /> Selesaikan
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Beri Penilaian Anda</DialogTitle>
                    <DialogDescription>
                      Penilaian Anda sangat berarti untuk kami.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div>
                      <Label>Rating (1 - 10)</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(
                          (num) => (
                            <Button
                              key={num}
                              variant={rating === num ? "default" : "outline"}
                              size="sm"
                              className="w-10 h-10"
                              onClick={() => setRating(num)}
                            >
                              {num}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                    <div>
                      <Label>Review (Opsional)</Label>
                      <Textarea
                        placeholder="Bagaimana pengalaman Anda dengan layanan ini?"
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleCompleteRequest}
                      disabled={isSubmitting}
                    >
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Kirim Penilaian
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </Content>
      )}

      {permin.rating && (
        <Content size="sm" title="Penilaian Anda">
          <Card>
            <CardHeader>
              <CardTitle>Rating: {permin.rating}/10</CardTitle>
            </CardHeader>
            <CardContent>
              <Label>Review:</Label>
              <blockquote className="mt-2 pl-4 border-l-2 italic text-muted-foreground">
                {permin.review || "Tidak ada review yang diberikan."}
              </blockquote>
            </CardContent>
          </Card>
        </Content>
      )}
    </>
  );
}
