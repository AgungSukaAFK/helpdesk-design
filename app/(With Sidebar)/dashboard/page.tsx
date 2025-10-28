// app/dashboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

// Components
import { Content } from "@/components/content";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Icons
import {
  FilePlus2,
  GitPullRequest,
  Loader2,
  MessageSquareQuote,
  Star,
  TrendingUp,
} from "lucide-react";

// Interfaces
interface DashboardStats {
  permintaanBaru: number;
  sedangDikerjakan: number;
  menungguRevisi: number;
  selesaiBulanIni: number;
  rataRataRating: number | null;
  rataRataWaktuPengerjaan: string | null;
}

interface PermintaanTerbaru {
  id: string;
  judul: string;
  admin: string;
  requester: string;
  project: string;
  created_at: Date;
  due_date: Date;
  status: string;
}

interface TrenHarian {
  request_date: string;
  total: number;
}

export default function DashboardPage() {
  const s = createClient();

  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [permintaanTerbaru, setPermintaanTerbaru] = useState<
    PermintaanTerbaru[]
  >([]);
  const [trenHarian, setTrenHarian] = useState<TrenHarian[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const [statsResult, trendResult, terbaruResult] = await Promise.all([
          s.rpc("get_dashboard_stats"),
          s.rpc("get_daily_request_trend", { days_limit: 30 }),
          s
            .from("permintaan")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (statsResult.error) throw statsResult.error;
        setStats(statsResult.data);

        if (trendResult.error) throw trendResult.error;
        setTrenHarian(trendResult.data);

        if (terbaruResult.error) throw terbaruResult.error;
        if (!terbaruResult.data) {
          setPermintaanTerbaru([]);
          return;
        }

        // ==================================================================
        // REVISI: Mengambil nama berdasarkan ID pengguna (UUID)
        // ==================================================================

        // 1. Kumpulkan semua ID pengguna dari kolom 'requester'
        let userIds = terbaruResult.data.map((req) => req.requester);
        userIds = [...userIds, terbaruResult.data.map((req) => req.admin)];
        if (userIds.length === 0) {
          setPermintaanTerbaru([]);
          return;
        }

        // 2. Ambil data profil dari tabel 'user_profiles' berdasarkan ID
        const { data: usersData, error: usersError } = await s
          .from("user_profiles") // Pastikan nama tabel ini benar
          .select("id, name") // Ambil id dan name
          .in("id", userIds); // Cocokkan berdasarkan 'id'

        if (usersError) throw usersError;

        // 3. Buat peta (map) dari ID ke Nama untuk pencocokan cepat
        const idToNameMap: Record<string, string> = {};
        usersData?.forEach((user) => {
          if (user.id && user.name) {
            idToNameMap[user.id] = user.name;
          }
        });

        // 4. Ganti ID requester dengan nama yang sesuai dari peta
        const permintaanDenganNama = terbaruResult.data.map((req) => ({
          ...req,
          requester: idToNameMap[req.requester] || "User Tidak Dikenal", // Ganti ID dengan nama
          admin: idToNameMap[req.admin] || "User Tidak Dikenal", // Ganti ID dengan nama
        }));
        console.log(permintaanDenganNama);
        setPermintaanTerbaru(permintaanDenganNama);
      } catch (error: any) {
        toast.error("Gagal memuat data dashboard: " + error.message);
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [s]);

  const renderLoading = () => <Loader2 className="h-6 w-6 animate-spin" />;

  return (
    <>
      {/* Aktivitas Terkini */}
      <Content
        size="lg"
        title="Aktivitas Terkini"
        description="5 permintaan desain terakhir yang masuk atau diupdate."
      >
        {/* PERBAIKAN 1: Tambahkan wrapper ini.
    Ini adalah cara standar shadcn/ui agar tabel bisa di-scroll
    horizontal di layar kecil (HP) dan tidak merusak layout.
  */}
        <div className="w-full overflow-x-auto rounded-md border">
          {/* Kita beri lebar minimum agar kolom tidak terlalu sempit
      sebelum scrolling-nya aktif.
    */}
          <Table className="min-w-[900px]">
            <TableHeader>
              {/* Struktur header Anda tetap sama (8 kolom) */}
              <TableRow>
                <TableHead>Judul Permintaan</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Tanggal permintaan</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Peminta</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  {/* PERBAIKAN 2: colSpan harus 8, sesuai jumlah kolom
                   */}
                  <TableCell colSpan={8} className="h-24 text-center">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : permintaanTerbaru.length > 0 ? (
                permintaanTerbaru.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell
                      className="font-medium truncate max-w-xs"
                      title={req.judul}
                    >
                      {req.judul}
                    </TableCell>
                    <TableCell
                      className="font-medium truncate max-w-xs"
                      title={req.project}
                    >
                      {req.project}
                    </TableCell>
                    {/* Beri min-w agar kolom tanggal tidak wrap aneh */}
                    <TableCell className="font-medium min-w-[160px]">
                      {new Date(req.created_at.toString()).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "long", // Format asli Anda
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell className="font-medium min-w-[160px]">
                      {new Date(req.due_date.toString()).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "long", // Format asli Anda
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell>{req.requester}</TableCell>
                    <TableCell>{req.admin || "-"}</TableCell>{" "}
                    <TableCell>
                      <Badge
                        variant={
                          req.status === "DONE" ? "default" : "secondary"
                        }
                      >
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/permintaan-desain-admin/${req.id}`}>Lihat</a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  {/* PERBAIKAN 2: colSpan juga harus 8 di sini
                   */}
                  <TableCell colSpan={8} className="h-24 text-center">
                    Belum ada aktivitas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* KPI Cards */}
      <Content
        size="xs"
        title="Baru (Minggu Ini)"
        className="bg-blue-300 dark:bg-blue-950"
        description="Permintaan baru dalam 7 hari"
        cardAction={<FilePlus2 className="h-4 w-4 text-muted-foreground" />}
      >
        <p className="text-2xl font-bold">
          {loading ? renderLoading() : stats?.permintaanBaru ?? 0}
        </p>
      </Content>
      <Content
        size="xs"
        title="Sedang Dikerjakan"
        className="bg-cyan-400 dark:bg-cyan-950"
        description="Status PROGRESS"
        cardAction={
          <GitPullRequest className="h-4 w-4 text-muted-foreground" />
        }
      >
        <p className="text-2xl font-bold">
          {loading ? renderLoading() : stats?.sedangDikerjakan ?? 0}
        </p>
      </Content>
      <Content
        size="xs"
        title="Menunggu Revisi"
        className="bg-yellow-400 dark:bg-yellow-700"
        description="Status REVISION"
        cardAction={
          <MessageSquareQuote className="h-4 w-4 text-muted-foreground" />
        }
      >
        <p className="text-2xl font-bold">
          {loading ? renderLoading() : stats?.menungguRevisi ?? 0}
        </p>
      </Content>

      <Content
        size="xs"
        title="Selesai (Bulan Ini)"
        className="bg-red-300 dark:bg-red-700"
        description="Permintaan selesai bulan ini"
        cardAction={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
      >
        <p className="text-2xl font-bold">
          {loading ? renderLoading() : `+${stats?.selesaiBulanIni ?? 0}`}
        </p>
      </Content>

      {/* Statistik Kinerja */}
      <Content
        size="md"
        title="Rata-rata Rating Kepuasan"
        description="Dari semua permintaan yang selesai"
        cardAction={<Star className="h-5 w-5 text-yellow-400" />}
      >
        <p className="text-4xl font-bold">
          {loading
            ? renderLoading()
            : `${stats?.rataRataRating?.toFixed(1) ?? "N/A"} / 10`}
        </p>
      </Content>

      {/* Chart Tren */}
      <Content size="lg" title="Tren Permintaan (30 Hari Terakhir)">
        {loading ? (
          <div className="flex h-[350px] w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={trenHarian}>
              <XAxis
                dataKey="request_date"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Bar
                dataKey="total"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Content>
    </>
  );
}
