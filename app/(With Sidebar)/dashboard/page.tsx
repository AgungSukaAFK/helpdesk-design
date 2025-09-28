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
  requester: string;
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

  // useEffect untuk fetch data (tidak ada perubahan)
  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const [statsResult, trendResult, terbaruResult] = await Promise.all([
          s.rpc("get_dashboard_stats"),
          s.rpc("get_daily_request_trend", { days_limit: 30 }),
          s
            .from("permintaan")
            .select("id, judul, requester, status")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (statsResult.error) throw statsResult.error;
        setStats(statsResult.data);

        if (trendResult.error) throw trendResult.error;
        setTrenHarian(trendResult.data);

        if (terbaruResult.error) throw terbaruResult.error;
        setPermintaanTerbaru(terbaruResult.data);
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
      {/* KPI Cards */}
      <Content
        size="xs"
        title="Baru (Minggu Ini)"
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
      {/* <Content
        size="md"
        title="Rata-rata Waktu Pengerjaan"
        description="Dari permintaan dibuat hingga selesai"
        cardAction={<Clock className="h-5 w-5 text-blue-400" />}
      >
        <p className="text-3xl font-bold">
          {loading ? renderLoading() : stats?.rataRataWaktuPengerjaan ?? "N/A"}
        </p>
      </Content> */}

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

      {/* Aktivitas Terkini */}
      <Content
        size="lg"
        title="Aktivitas Terkini"
        description="5 permintaan desain terakhir yang masuk atau diupdate."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judul Permintaan</TableHead>
              <TableHead>Peminta</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : permintaanTerbaru.length > 0 ? (
              permintaanTerbaru.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.judul}</TableCell>
                  <TableCell>{req.requester || "N/A"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={req.status === "DONE" ? "default" : "secondary"}
                    >
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      {/* Arahkan ke halaman detail admin jika user adalah admin, jika bukan ke halaman user biasa */}
                      <a href={`/permintaan-desain-admin/${req.id}`}>Lihat</a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Belum ada aktivitas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Content>
    </>
  );
}
