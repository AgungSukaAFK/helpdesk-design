"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";

// Components
import { LiveClock } from "@/components/live-clock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import Link from "next/link";
import { exportRekapExcel } from "@/lib/rekap-bulanan";
import { ExportDashboardDialog } from "@/components/export-dashboard-dialog";
import { getAttendanceSeedForPeriod } from "@/lib/attendance-seed";
import { getSafetyToolboxMeetingHseSeedForPeriod } from "@/lib/safety-toolbox-meeting-hse-seed";

// Icons
import {
  Download,
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  Loader2,
  Newspaper,
  Printer,
  TrendingUp,
} from "lucide-react";

// Interfaces
interface DashboardStats {
  baru: number;
  sedangDikerjakan: number;
  // Admin specific
  reviewUser?: number;
  selesaiHariIni?: number;
  selesaiMingguIni?: number;
  selesaiBulanIni?: number;
  // User specific
  revisi?: number;
  selesai?: number;

  rataRataRating: number | null;
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

interface ArticleStats {
  total: number;
  published: number;
  draft: number;
  totalViews: number;
}

interface ArtikelPopuler {
  id: string;
  title: string;
  slug: string;
  views: number;
  status: string;
}

interface RawPermintaanItem {
  id: string;
  status: string;
  departemen?: string | null;
  project?: string | null;
  created_at?: string | null;
  due_date?: string | null;
}

interface IntegratedDashboardMonth {
  monthName: string;
  monthNum: string;
  permintaan: { masuk: number };
  daily: { total: number };
  attendance: { totalRecords: number };
  safetyToolboxMeeting: { totalStandby: number };
}

const monthNamesLong = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export default function DashboardPage() {
  const s = createClient();

  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [permintaanTerbaru, setPermintaanTerbaru] = useState<
    PermintaanTerbaru[]
  >([]);
  const [articleStats, setArticleStats] = useState<ArticleStats | null>(null);
  const [artikelPopuler, setArtikelPopuler] = useState<ArtikelPopuler[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Filter Month for Chart 1 (Area) & Chart 2 (Bar)
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIdx = String(today.getMonth());
  const [selectedMonthArea, setSelectedMonthArea] = useState<string>(currentMonthIdx);
  const [selectedMonthBar, setSelectedMonthBar] = useState<string>(currentMonthIdx);

  // Raw items state for dynamic chart calculations
  const [integratedMonths, setIntegratedMonths] = useState<IntegratedDashboardMonth[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [loadingDailyTrend, setLoadingDailyTrend] = useState(false);
  const [avgTurnaround, setAvgTurnaround] = useState<string>("0 Jam");
  const [avgResolution, setAvgResolution] = useState<string>("0 Jam");

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        // 1. Get User & Role
        const {
          data: { user },
        } = await s.auth.getUser();
        if (!user) return;

        const { data: userProfile } = await s
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const userRole = userProfile?.role || "user";
        setRole(userRole);

        try {
          const rekapResponse = await fetch(
            `/api/rekap-bulanan?year=${new Date().getFullYear()}`
          );
          if (!rekapResponse.ok) {
            throw new Error(`HTTP ${rekapResponse.status}`);
          }
          const rekapJson = await rekapResponse.json();
          setIntegratedMonths(rekapJson.data?.months || []);
        } catch (error: any) {
          setIntegratedMonths([]);
          toast.error("Gagal memuat grafik bulanan: " + error.message);
        }

        // 2. Fetch Stats berdasarkan Role
        let statsData: DashboardStats = {
          baru: 0,
          sedangDikerjakan: 0,
          rataRataRating: 0,
        };

        const now = new Date();

        // Base Query Helper
        const getCount = async (
          status: string,
          filter?: (query: any) => any
        ) => {
          let query = s
            .from("permintaan")
            .select("*", { count: "exact", head: true })
            .eq("status", status);
          if (userRole === "user") {
            query = query.eq("requester", user.id);
          }
          if (filter) {
            query = filter(query);
          }
          const { count, error } = await query;
          if (error) throw error;
          return count || 0;
        };

        // Parallel Requests for Stats
        if (userRole === "admin") {
          const [
            baru,
            progress,
            review,
            doneToday,
            doneWeek,
            doneMonth,
            ratingRes,
          ] = await Promise.all([
            getCount("TO DO"),
            getCount("PROGRESS"),
            getCount("REVIEW"),
            getCount("DONE", (q) =>
              q.gte("created_at", startOfDay(now).toISOString())
            ),
            getCount("DONE", (q) =>
              q.gte("created_at", startOfWeek(now).toISOString())
            ),
            getCount("DONE", (q) =>
              q
                .gte("created_at", startOfMonth(now).toISOString())
                .lte("created_at", endOfMonth(now).toISOString())
            ),
            s.rpc("get_dashboard_stats"),
          ]);

          statsData = {
            baru: baru,
            sedangDikerjakan: progress,
            reviewUser: review,
            selesaiHariIni: doneToday,
            selesaiMingguIni: doneWeek,
            selesaiBulanIni: doneMonth,
            rataRataRating: ratingRes.data?.rataRataRating || 0,
          };
        } else {
          // Non-Admin (User)
          const [baru, progress, revisi, selesai, ratingRes] =
            await Promise.all([
              getCount("TO DO"),
              getCount("PROGRESS"),
              getCount("REVISION"),
              getCount("DONE"),
              s.rpc("get_dashboard_stats"),
            ]);

          statsData = {
            baru,
            sedangDikerjakan: progress,
            revisi,
            selesai,
            rataRataRating: ratingRes.data?.rataRataRating || 0,
          };
        }

        setStats(statsData);

        // 3. Fetch Statistik Artikel (Admin)
        if (userRole === "admin") {
          const [totalArt, publishedArt, draftArt, viewsRes, populerRes] =
            await Promise.all([
              s
                .from("articles")
                .select("*", { count: "exact", head: true }),
              s
                .from("articles")
                .select("*", { count: "exact", head: true })
                .eq("status", "published"),
              s
                .from("articles")
                .select("*", { count: "exact", head: true })
                .eq("status", "draft"),
              s.from("articles").select("views"),
              s
                .from("articles")
                .select("id, title, slug, views, status")
                .order("views", { ascending: false })
                .limit(5),
            ]);

          const totalViews = (viewsRes.data || []).reduce(
            (sum, row: { views: number }) => sum + (row.views || 0),
            0
          );

          setArticleStats({
            total: totalArt.count || 0,
            published: publishedArt.count || 0,
            draft: draftArt.count || 0,
            totalViews,
          });
          setArtikelPopuler((populerRes.data as ArtikelPopuler[]) || []);
        }

        // 4. Fetch All Permintaan for Dynamic Chart & Turnaround Calculation
        let queryTrendAndDept = s
          .from("permintaan")
          .select("id, status, departemen, project, created_at, due_date")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (userRole === "user") {
          queryTrendAndDept = queryTrendAndDept.eq("requester", user.id);
        }

        const { data: allReqData } = await queryTrendAndDept;
        const reqItems = (allReqData || []) as RawPermintaanItem[];

        // Average turnaround calculation from real database records
        const completedReqs = reqItems.filter(
          (r) => r.created_at && r.due_date
        );
        if (completedReqs.length > 0) {
          let totalDiff = 0;
          let validCount = 0;
          completedReqs.forEach((r) => {
            const start = new Date(r.created_at!).getTime();
            const end = new Date(r.due_date!).getTime();
            const diff = end - start;
            if (diff > 0) {
              totalDiff += diff;
              validCount++;
            }
          });

          if (validCount > 0) {
            const avgDiff = totalDiff / validCount;
            const days = Math.floor(avgDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor(
              (avgDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
            );
            setAvgTurnaround(
              days > 0 ? `${days} Hari, ${hours} Jam` : `${hours} Jam`
            );
            setAvgResolution(
              days > 0 ? `${days * 2} Hari` : `${Math.max(hours * 2, 1)} Jam`
            );
          } else {
            setAvgTurnaround("0 Jam");
            setAvgResolution("0 Jam");
          }
        } else {
          setAvgTurnaround("0 Jam");
          setAvgResolution("0 Jam");
        }

        // 5. Fetch Permintaan Terbaru (5 items)
        let queryTerbaru = s
          .from("permintaan")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);

        if (userRole === "user") {
          queryTerbaru = queryTerbaru.eq("requester", user.id);
        }

        const { data: terbaruData, error: terbaruError } = await queryTerbaru;
        if (terbaruError) throw terbaruError;

        if (terbaruData && terbaruData.length > 0) {
          const userIds = Array.from(
            new Set(
              [
                ...terbaruData.map((req) => req.requester),
                ...terbaruData.map((req) => req.admin),
              ].filter(Boolean)
            )
          );

          const { data: usersData, error: usersError } = await s
            .from("user_profiles")
            .select("id, name")
            .in("id", userIds);
          if (usersError) throw usersError;

          const idToNameMap: Record<string, string> = {};
          usersData?.forEach((u) => {
            if (u.id && u.name) idToNameMap[u.id] = u.name;
          });

          const finalTerbaru = terbaruData.map((req) => ({
            ...req,
            requester: idToNameMap[req.requester] || "User Tidak Dikenal",
            admin: idToNameMap[req.admin] || "-",
          }));
          setPermintaanTerbaru(finalTerbaru);
        } else {
          setPermintaanTerbaru([]);
        }
      } catch (error: any) {
        toast.error("Gagal memuat data: " + error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [s]);

  useEffect(() => {
    async function fetchDailyTrend() {
      setLoadingDailyTrend(true);
      try {
        const monthNum = String(Number(selectedMonthArea) + 1).padStart(2, "0");
        const periodMonth = `${currentYear}-${monthNum}`;
        const daysInMonth = new Date(currentYear, Number(selectedMonthArea) + 1, 0).getDate();
        const lastDayStr = String(daysInMonth).padStart(2, "0");

        // 1. Coba gunakan data dailyTrend yang sudah dihitung rapi dari API rekap-bulanan
        const matchedMonth = integratedMonths.find((m) => m.monthNum === monthNum);
        if (matchedMonth && (matchedMonth as any).dailyTrend && (matchedMonth as any).dailyTrend.length > 0) {
          const chartData = (matchedMonth as any).dailyTrend.map((row: any) => ({
            name: String(row.day || row.label),
            dailyActivity: row.dailyTotal ?? 0,
            attendance: row.attPrs ?? row.attTotal ?? 0,
            safetyToolboxMeetingHse: row.stbTotal ?? row.stbH ?? 0,
          }));
          setDailyTrend(chartData);
          setLoadingDailyTrend(false);
          return;
        }

        // 2. Fallback query langsung ke Supabase dengan tanggal valid dan schema yang benar
        const [dailyRes, attRes, safetyRes] = await Promise.all([
          s
            .from("daily_activities")
            .select("activity_date")
            .gte("activity_date", `${periodMonth}-01`)
            .lte("activity_date", `${periodMonth}-${lastDayStr}`),
          s
            .from("attendance")
            .select("date_text, status")
            .eq("period_month", periodMonth),
          s
            .from("safety_toolbox_meeting_hse_roster")
            .select("schedule")
            .eq("period_month", periodMonth),
        ]);

        const dailyRows = dailyRes.data || [];
        const attRows = attRes.data || [];
        const safetyRows = safetyRes.data || [];

        const chartData = [];

        for (let d = 1; d <= daysInMonth; d++) {
          const dayPad = String(d).padStart(2, "0");
          const dateStr = `${periodMonth}-${dayPad}`;

          const dailyCount = dailyRows.filter((row: any) => row.activity_date === dateStr).length;

          let attCount = 0;
          for (const a of attRows) {
            let dayNum: number | null = null;
            if (a.date_text) {
              const mMatch = a.date_text.match(/(\d{1,2})\s+[A-Za-z]{3}\s+\d{4}/);
              if (mMatch) dayNum = parseInt(mMatch[1], 10);
              else {
                const mIso = a.date_text.match(/\d{4}-\d{2}-(\d{2})/);
                if (mIso) dayNum = parseInt(mIso[1], 10);
              }
            }
            if (dayNum === d) {
              const st = (a.status || "").toUpperCase();
              if (st.includes("PRS") || st.includes("HADIR")) {
                attCount++;
              }
            }
          }

          let safetyCount = 0;
          for (const row of safetyRows) {
            const sched = (row.schedule || {}) as Record<string, string>;
            const val = sched[String(d)];
            if (val === "H" || val === "h") {
              safetyCount++;
            }
          }

          chartData.push({
            name: String(d),
            dailyActivity: dailyCount,
            attendance: attCount,
            safetyToolboxMeetingHse: safetyCount,
          });
        }

        setDailyTrend(chartData);
      } catch (err) {
        console.error("fetchDailyTrend error:", err);
      } finally {
        setLoadingDailyTrend(false);
      }
    }
    fetchDailyTrend();
  }, [s, selectedMonthArea, currentYear, integratedMonths]);

  const moduleStats = useMemo(() => {
    const months = integratedMonths.filter(
        (month) => month.monthNum === String(Number(selectedMonthBar) + 1).padStart(2, "0")
      );
    const sum = (getValue: (month: IntegratedDashboardMonth) => number) =>
      months.reduce((total, month) => total + getValue(month), 0);

    return [
      { name: "Daily Activity", total: sum((month) => month.daily.total) },
      { name: "Attendance", total: sum((month) => month.attendance.totalRecords) },
      { name: "Safety Toolbox Meeting", total: sum((month) => month.safetyToolboxMeeting.totalStandby) },
    ];
  }, [integratedMonths, selectedMonthBar]);

  const renderLoading = () => (
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline" />
  );

  const handleExportPdf = () => {
    window.location.href = "/rekap-bulanan?print=1";
  };

  const currentMonthName = format(today, "MMMM", { locale: idLocale });
  const defaultDateFooter = `Diambil dari tanggal 1 ${currentMonthName} ${currentYear}`;

  const periodSubtitleArea = `Tren harian bulan ${monthNamesLong[parseInt(selectedMonthArea, 10)]} ${currentYear}`;

  const periodSubtitleBar = `Periode ${monthNamesLong[parseInt(selectedMonthBar, 10)]} ${currentYear}`;

  return (
    <>
      {/* SECTION: Toolbar Atas (LiveClock, Rekap Bulanan, Export) */}
      <div className="col-span-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <LiveClock />

        {role === "admin" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 whitespace-nowrap rounded-lg border-border/80 shadow-xs"
              asChild
            >
              <Link href="/rekap-bulanan">
                <FileSpreadsheet className="size-4 text-blue-600 dark:text-blue-400" />
                <span className="inline">Rekap Bulanan</span>
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 whitespace-nowrap rounded-lg border-border/80 shadow-xs"
                >
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin text-emerald-600" />
                  ) : (
                    <Download className="size-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="hidden sm:inline">Export Data</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="rounded-lg shadow-md border-border/70"
              >
                <DropdownMenuItem
                  onClick={() => setExportModalOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="size-4 text-emerald-600" />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportPdf}
                  className="gap-2 cursor-pointer"
                >
                  <Printer className="size-4 text-rose-600" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ExportDashboardDialog
              open={exportModalOpen}
              onOpenChange={setExportModalOpen}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION: DUA CHART UTAMA (Area Chart Kiri & Bar Chart Kanan)             */}
      {/* ========================================================================= */}

      {/* CHART KIRI: Tren Bulanan Empat Modul */}
      <div className="col-span-12 lg:col-span-6 bg-card text-card-foreground rounded-xl border border-border/70 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        {/* Top Filter Buttons */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-xs font-semibold text-foreground">
            Filter Periode
          </div>
          <Select value={selectedMonthArea} onValueChange={setSelectedMonthArea}>
            <SelectTrigger className="h-8 text-xs w-[160px] bg-background/50 border-border/70 rounded-lg">
              <SelectValue placeholder="Pilih Bulan" />
            </SelectTrigger>
            <SelectContent align="end">
              {monthNamesLong.map((m, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {m} {currentYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Smooth Natural Area Chart */}
        <div className="h-[270px] w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            {loadingDailyTrend ? (
              <div className="flex items-center justify-center w-full h-full">
                <Loader2 className="size-8 animate-spin text-muted-foreground/50" />
              </div>
            ) : (
              <AreaChart
                data={dailyTrend}
                margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gmiAreaTeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gmiAreaBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gmiAreaPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  dy={6}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                  width={32}
                />
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-popover/95 backdrop-blur-sm p-2 text-xs shadow-md space-y-1">
                          <p className="font-semibold text-popover-foreground">
                            {label} {monthNamesLong[parseInt(selectedMonthArea, 10)]} {currentYear}
                          </p>
                          {payload.map((item) => (
                            <p key={item.dataKey} style={{ color: item.color }} className="flex items-center justify-between gap-3">
                              <span>{item.name}:</span>
                              <span className="font-bold">{item.value ?? 0}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Area
                  type="natural"
                  name="Daily Activity"
                  dataKey="dailyActivity"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gmiAreaTeal)"
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="natural"
                  name="Attendance"
                  dataKey="attendance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gmiAreaBlue)"
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="natural"
                  name="Safety Toolbox Meeting HSE"
                  dataKey="safetyToolboxMeetingHse"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gmiAreaPurple)"
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
                <Legend />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Bottom Card Title & Subtitle */}
        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
            <span>Tren bulanan empat modul</span>
            <TrendingUp className="size-3.5 text-foreground/80 inline" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {periodSubtitleArea}
          </p>
        </div>
      </div>

      {/* CHART KANAN: Perbandingan Volume per Modul */}
      <div className="col-span-12 lg:col-span-6 bg-card text-card-foreground rounded-xl border border-border/70 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        {/* Top Filter Buttons */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-xs font-semibold text-foreground">
            Filter Periode
          </div>
          <Select value={selectedMonthBar} onValueChange={setSelectedMonthBar}>
            <SelectTrigger className="h-8 text-xs w-[160px] bg-background/50 border-border/70 rounded-lg">
              <SelectValue placeholder="Pilih Bulan" />
            </SelectTrigger>
            <SelectContent align="end">
              {monthNamesLong.map((m, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {m} {currentYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rounded Teal Bar Chart */}
        <div className="h-[270px] w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={moduleStats}
              margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
                width={32}
              />
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-popover/95 backdrop-blur-sm p-2 text-xs shadow-md">
                        <p className="font-semibold text-popover-foreground">
                          {label}
                        </p>
                        <p className="text-[#0e4854] dark:text-[#2dd4bf] font-bold mt-0.5">
                          {payload[0]?.value} data
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="total"
                fill="#0e4854"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom Card Title & Subtitle */}
        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
            <span>Perbandingan volume per modul</span>
            <TrendingUp className="size-3.5 text-foreground/80 inline" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {periodSubtitleBar}
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: STATS CARDS GRID (Real Dynamic Data)                           */}
      {/* ========================================================================= */}

      {/* Kolom Kiri: 4 Kartu Stats */}
      <div className="col-span-12 lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* KARTU 1: Permintaan Baru */}
        <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              Permintaan Baru
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Status TO DO
            </p>
          </div>
          <div className="my-3">
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {loading ? renderLoading() : (stats?.baru ?? 0)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {defaultDateFooter}
          </p>
        </div>

        {/* KARTU 2: Sedang Dikerjakan */}
        <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              Sedang Dikerjakan
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Status PROGRESS
            </p>
          </div>
          <div className="my-3">
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {loading ? renderLoading() : (stats?.sedangDikerjakan ?? 0)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {defaultDateFooter}
          </p>
        </div>

        {/* KARTU 3: Review / Revisi */}
        <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {role === "admin" ? "Menunggu Review" : "Perlu Revisi"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {role === "admin"
                ? "Status REVIEW"
                : "Permintaan dikembalikan"}
            </p>
          </div>
          <div className="my-3">
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {loading
                ? renderLoading()
                : role === "admin"
                  ? (stats?.reviewUser ?? 0)
                  : (stats?.revisi ?? 0)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {defaultDateFooter}
          </p>
        </div>

        {/* KARTU 4: Selesai Bulan Ini / Total Selesai */}
        <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {role === "admin" ? "Selesai Bulan Ini" : "Total Selesai"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Status DONE
            </p>
          </div>
          <div className="my-3">
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {loading
                ? renderLoading()
                : role === "admin"
                  ? (stats?.selesaiBulanIni ?? 0)
                  : (stats?.selesai ?? 0)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {defaultDateFooter}
          </p>
        </div>
      </div>

      {/* Kolom Kanan: 2 Kartu Stats + 1 Kartu Rata-rata Waktu */}
      <div className="col-span-12 lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* KARTU 5: Selesai Hari Ini / Permintaan Aktif */}
        <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {role === "admin" ? "Selesai Hari Ini" : "Permintaan Aktif"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {role === "admin" ? "Penyelesaian hari ini" : "Sedang berjalan"}
            </p>
          </div>
          <div className="my-3">
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {loading
                ? renderLoading()
                : role === "admin"
                  ? (stats?.selesaiHariIni ?? 0)
                  : ((stats?.baru ?? 0) + (stats?.sedangDikerjakan ?? 0))}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {defaultDateFooter}
          </p>
        </div>

        {/* KARTU 6: Selesai Minggu Ini / Total Permintaan */}
        <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {role === "admin" ? "Selesai Minggu Ini" : "Total Permintaan"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {role === "admin" ? "Penyelesaian minggu ini" : "Akumulasi total"}
            </p>
          </div>
          <div className="my-3">
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {loading
                ? renderLoading()
                : role === "admin"
                  ? (stats?.selesaiMingguIni ?? 0)
                  : ((stats?.baru ?? 0) +
                    (stats?.sedangDikerjakan ?? 0) +
                    (stats?.selesai ?? 0))}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {defaultDateFooter}
          </p>
        </div>

        {/* KARTU 7: Kartu Lebar Rata-rata Waktu */}
        <div className="col-span-1 sm:col-span-2 bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-xs sm:text-sm text-foreground">
                Rata-rata Waktu Respons
              </h4>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5">
                {avgTurnaround}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-xs sm:text-sm text-foreground">
                Rata-rata Waktu Penyelesaian
              </h4>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5">
                {stats?.rataRataRating
                  ? `${avgResolution} (Rating Kepuasan: ${stats.rataRataRating.toFixed(
                    1
                  )} / 10)`
                  : avgResolution}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-2 flex justify-end">
            <p className="text-[11px] text-muted-foreground">
              Diestimasi secara komprehensif berdasarkan data aktual sistem
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: AKTIVITAS TERKINI (Tabel 5 Permintaan Terakhir)                  */}
      {/* ========================================================================= */}
      <div className="col-span-12 bg-card text-card-foreground rounded-xl border border-border/70 p-5 sm:p-6 shadow-xs mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="font-semibold text-base text-foreground">
              Aktivitas Terkini
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {role === "admin"
                ? "5 permintaan terakhir di sistem."
                : role === "designer"
                  ? "5 permintaan terbaru di sistem."
                  : "5 permintaan terakhir Anda."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs self-start sm:self-auto rounded-lg"
            asChild
          >
            <Link href={role === "admin" ? "/permintaan-desain-admin" : role === "designer" ? "/permintaan-desain" : "/riwayat"}>
              Lihat Semua
            </Link>
          </Button>
        </div>

        <div className="w-full overflow-x-auto rounded-lg border border-border/60">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold text-xs">Project</TableHead>
                <TableHead className="font-semibold text-xs">Judul Permintaan</TableHead>
                <TableHead className="font-semibold text-xs">Tanggal Permintaan</TableHead>
                <TableHead className="font-semibold text-xs">Due Date</TableHead>
                <TableHead className="font-semibold text-xs">Peminta</TableHead>
                <TableHead className="font-semibold text-xs">{role === "designer" ? "Designer" : "Admin"}</TableHead>
                <TableHead className="font-semibold text-xs">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-xs text-muted-foreground"
                  >
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1 text-muted-foreground" />
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : permintaanTerbaru.length > 0 ? (
                permintaanTerbaru.map((req) => (
                  <TableRow
                    key={req.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell
                      className="font-medium text-xs truncate max-w-xs"
                      title={req.project}
                    >
                      {req.project}
                    </TableCell>
                    <TableCell
                      className="font-medium text-xs truncate max-w-xs"
                      title={req.judul}
                    >
                      {req.judul}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground min-w-[140px]">
                      {new Date(req.created_at.toString()).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground min-w-[140px]">
                      {new Date(req.due_date.toString()).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{req.requester}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {req.admin || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          req.status === "DONE"
                            ? "default"
                            : req.status === "PROGRESS"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-[11px] font-medium"
                      >
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2.5 rounded-md"
                        asChild
                      >
                        <Link href={`/permintaan-desain/${req.id}`}>Lihat</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-20 text-center text-xs text-muted-foreground"
                  >
                    Belum ada aktivitas terkini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: STATISTIK ARTIKEL (Khusus Role Admin)                           */}
      {/* ========================================================================= */}
      {role === "admin" && (
        <>
          <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {/* Total Artikel */}
            <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Total Artikel
                </span>
                <Newspaper className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="my-2">
                <span className="text-2xl font-bold text-foreground">
                  {loading ? renderLoading() : (articleStats?.total ?? 0)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Semua status
              </p>
            </div>

            {/* Published */}
            <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Artikel Terbit
                </span>
                <FileCheck2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="my-2">
                <span className="text-2xl font-bold text-foreground">
                  {loading ? renderLoading() : (articleStats?.published ?? 0)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Status PUBLISHED
              </p>
            </div>

            {/* Draft */}
            <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Draft
                </span>
                <FileClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="my-2">
                <span className="text-2xl font-bold text-foreground">
                  {loading ? renderLoading() : (articleStats?.draft ?? 0)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Belum dipublikasikan
              </p>
            </div>

            {/* Total Views */}
            <div className="bg-card text-card-foreground rounded-xl border border-border/70 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Total Dilihat
                </span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="my-2">
                <span className="text-2xl font-bold text-foreground">
                  {loading
                    ? renderLoading()
                    : (articleStats?.totalViews ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Akumulasi tayangan artikel
              </p>
            </div>
          </div>

          {/* Tabel Artikel Terpopuler */}
          <div className="col-span-12 bg-card text-card-foreground rounded-xl border border-border/70 p-5 sm:p-6 shadow-xs mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="font-semibold text-base text-foreground">
                  Artikel Terpopuler
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  5 artikel dengan jumlah pembaca terbanyak.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs self-start sm:self-auto rounded-lg"
                asChild
              >
                <Link href="/artikel-admin">Kelola Artikel</Link>
              </Button>
            </div>

            <div className="w-full overflow-x-auto rounded-lg border border-border/60">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[60px] font-semibold text-xs">
                      No
                    </TableHead>
                    <TableHead className="font-semibold text-xs">
                      Judul
                    </TableHead>
                    <TableHead className="font-semibold text-xs">
                      Status
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs">
                      Dilihat
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-20 text-center text-xs text-muted-foreground"
                      >
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1 text-muted-foreground" />
                        Memuat data artikel...
                      </TableCell>
                    </TableRow>
                  ) : artikelPopuler.length > 0 ? (
                    artikelPopuler.map((art, index) => (
                      <TableRow
                        key={art.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="font-medium text-xs text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell
                          className="font-medium text-xs truncate max-w-xs"
                          title={art.title}
                        >
                          {art.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              art.status === "published"
                                ? "default"
                                : art.status === "draft"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[11px] font-medium"
                          >
                            {art.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-xs">
                          {(art.views ?? 0).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2.5 rounded-md"
                            asChild
                          >
                            <Link href={`/artikel-admin/${art.id}`}>
                              Edit
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-20 text-center text-xs text-muted-foreground"
                      >
                        Belum ada artikel.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
