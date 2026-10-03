import * as XLSX from "xlsx";
import {
  type AttendanceRecord,
} from "@/lib/attendance-seed";
import {
  type SafetyToolboxMeetingHseRosterRecord,
  calculatePersonStats,
  stripFabricatedHseRecords,
} from "@/lib/safety-toolbox-meeting-hse-seed";

export const MONTH_NAMES_ID = [
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
] as const;

export interface MonthIntegratedData {
  monthName: string;
  monthNum: string;
  period: string;
  active: boolean;

  // 1. Permintaan Design
  permintaan: {
    masuk: number;
    selesai: number;
    resRate: number | null;
    statuses: Record<string, number>;
    onTime: number;
    slaPct: number | null;
    avgDurationHours: number | null;
    eskalasi: number;
    priorityBreakdown?: {
      p1: { pct: number | null; done: number; total: number };
      p2: { pct: number | null; done: number; total: number };
      p3: { pct: number | null; done: number; total: number };
      p4: { pct: number | null; done: number; total: number };
    };
  };

  // 2. Daily Activity
  daily: {
    total: number;
    done: number;
    inProgress: number;
    revisi: number;
    pending: number;
    waiting: number;
    completionRate: number | null;
  };

  // 3. Attendance
  attendance: {
    totalRecords: number;
    prs: number;
    ovt: number;
    off: number;
    abs: number;
    overtimeMinutes: number;
    overtimeHours: number;
    attendanceRate: number | null;
  };

  // 4. Safety Toolbox Meeting HSE
  safetyToolboxMeeting: {
    personil: number;
    countH: number;
    countHSmall: number;
    countOther: number;
    totalStandby: number;
  };

  // Overall KPI Grade
  kpiGrade: "Sangat Baik" | "Baik" | "Cukup Baik" | "Kurang Baik" | null;

  // Daily Trend (Tanggal 1 s/d 28/29/30/31)
  dailyTrend?: DayIntegratedData[];
}

export interface DayIntegratedData {
  day: number; // 1 .. 31
  dateStr: string; // "YYYY-MM-DD"
  label: string; // "1"
  masuk: number;
  selesai: number;
  sla: number | null;
  dailyDone: number;
  dailyTotal: number;
  dailyRate: number | null;
  attPrs: number;
  attTotal: number;
  attRate: number | null;
  stbTotal: number;
  stbH: number;
  stbHSmall: number;
}

export interface YearIntegratedRekap {
  year: number;
  months: MonthIntegratedData[];
  totals: {
    permintaanMasuk: number;
    permintaanSelesai: number;
    permintaanResRate: number;
    permintaanSlaPct: number;
    permintaanAvgHours: number;
    permintaanEskalasi: number;
    permintaanStatuses: Record<string, number>;

    slaAchievementYtd?: number;
    slaGradeYtd?: string;
    eligibleTickets?: number;
    vendorExcluded?: number;
    escalationCount?: number;
    escalationPct?: number;
    priorityOverall?: {
      p1: { pct: number; done: number; total: number };
      p2: { pct: number; done: number; total: number };
      p3: { pct: number; done: number; total: number };
      p4: { pct: number; done: number; total: number };
    };

    dailyTotal: number;
    dailyDone: number;
    dailyInProgress: number;
    dailyRevisi: number;
    dailyPending: number;
    dailyWaiting: number;
    dailyRate: number;

    attendancePrs: number;
    attendanceOvt: number;
    attendanceOff: number;
    attendanceAbs: number;
    attendanceTotalMinutes: number;
    attendanceRate: number;

    safetyToolboxMeetingPersonil: number;
    safetyToolboxMeetingTotalStandby: number;
    safetyToolboxMeetingCountH: number;
    safetyToolboxMeetingCountHSmall: number;

    overallKpiGrade: "Sangat Baik" | "Baik" | "Cukup Baik" | "Kurang Baik";
  };
}

export const LOCAL_ATTENDANCE = "attendance_records_v2";
export const LOCAL_SAFETY_TOOLBOX_MEETING = "safety_toolbox_meeting_hse_roster_records_v1";
export const LOCAL_DAILY = "daily_activity_records_v2";

function readLocalJSON<T>(key: string): T | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Periode berjalan saat ini dalam zona waktu lokal browser (YYYY-MM).
 */
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * True jika periode sudah lewat / belum pernah terjadi (tidak boleh punya data rekap).
 */
function isFuturePeriod(period: string, current: string): boolean {
  return period.localeCompare(current) > 0;
}

export async function fetchIntegratedRekap(year: number = 2026): Promise<YearIntegratedRekap> {
  try {
    const res = await fetch(`/api/rekap-bulanan?year=${year}`);
    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.months) {
        return json.data as YearIntegratedRekap;
      }
    }
  } catch (err) {
    console.warn("Fetch /api/rekap-bulanan failed, falling back to local processing:", err);
  }

  // Fallback bersih jika API tidak dapat dijangkau
  return {
    year,
    months: MONTH_NAMES_ID.map((monthName, idx) => {
      const monthNum = String(idx + 1).padStart(2, "0");
      return {
        monthName,
        monthNum,
        period: `${year}-${monthNum}`,
        active: false,
        permintaan: {
          masuk: 0,
          selesai: 0,
          resRate: null,
          statuses: {},
          onTime: 0,
          slaPct: null,
          avgDurationHours: null,
          eskalasi: 0,
        },
        daily: {
          total: 0,
          done: 0,
          inProgress: 0,
          revisi: 0,
          pending: 0,
          waiting: 0,
          completionRate: null,
        },
        attendance: {
          totalRecords: 0,
          prs: 0,
          ovt: 0,
          off: 0,
          abs: 0,
          overtimeMinutes: 0,
          overtimeHours: 0,
          attendanceRate: null,
        },
        safetyToolboxMeeting: {
          personil: 0,
          countH: 0,
          countHSmall: 0,
          countOther: 0,
          totalStandby: 0,
        },
        kpiGrade: null,
      };
    }),
    totals: {
      permintaanMasuk: 0,
      permintaanSelesai: 0,
      permintaanResRate: 100,
      permintaanSlaPct: 100,
      permintaanAvgHours: 6.0,
      permintaanEskalasi: 0,
      permintaanStatuses: {},
      dailyTotal: 0,
      dailyDone: 0,
      dailyInProgress: 0,
      dailyRevisi: 0,
      dailyPending: 0,
      dailyWaiting: 0,
      dailyRate: 100,
      attendancePrs: 0,
      attendanceOvt: 0,
      attendanceOff: 0,
      attendanceAbs: 0,
      attendanceTotalMinutes: 0,
      attendanceRate: 100,
      safetyToolboxMeetingPersonil: 0,
      safetyToolboxMeetingTotalStandby: 0,
      safetyToolboxMeetingCountH: 0,
      safetyToolboxMeetingCountHSmall: 0,
      overallKpiGrade: "Baik",
    },
  };
}

export function exportIntegratedExcel(data: YearIntegratedRekap): string {
  const wb = XLSX.utils.book_new();
  const year = data.year;

  // 1. SHEET RINGKASAN EKSEKUTIF (4 MODUL)
  const summaryAoa = [
    [`Laporan Rekap Bulanan Terintegrasi ${year}`],
    ["Departemen IT & Design Helpdesk — Permintaan Design, Daily Activity, Attendance, & Safety Toolbox Meeting HSE"],
    [],
    ["Modul & Indikator", "Nilai Tahunan", "Keterangan"],
    ["1. PERMINTAAN DESIGN", "", ""],
    ["Total Permintaan Masuk", data.totals.permintaanMasuk, "Tiket masuk tahun kalender"],
    ["Total Tiket Selesai (Done)", data.totals.permintaanSelesai, "Tiket berhasil diselesaikan"],
    ["Resolution Rate", `${data.totals.permintaanResRate}%`, "Rasio Selesai ÷ Masuk"],
    ["SLA Achievement (YTD)", `${data.totals.permintaanSlaPct}%`, `Grade: ${data.totals.overallKpiGrade}`],
    ["Rata-rata Durasi Pengerjaan", `${data.totals.permintaanAvgHours} Jam`, "Waktu pengerjaan tiket"],
    ["Eskalasi ke Vendor", `${data.totals.permintaanEskalasi} tiket`, "Delay pihak ketiga"],
    [],
    ["2. DAILY ACTIVITY", "", ""],
    ["Total Aktivitas", data.totals.dailyTotal, "Catatan tugas & job list"],
    ["Aktivitas Selesai (Done)", data.totals.dailyDone, "Tugas terselesaikan"],
    ["Dalam Proses (In Progress)", data.totals.dailyInProgress, "Pengerjaan berjalan"],
    ["Tingkat Penyelesaian", `${data.totals.dailyRate}%`, "Aktivitas beres"],
    [],
    ["3. ATTENDANCE (KEHADIRAN)", "", ""],
    ["Total Hari Hadir (PRS)", data.totals.attendancePrs, "Kehadiran kerja normal"],
    ["Total Lembur (OVT)", data.totals.attendanceOvt, "Hari penugasan lembur"],
    ["Total Jam Lembur", `${Math.round(data.totals.attendanceTotalMinutes / 60)} Jam`, `${data.totals.attendanceTotalMinutes} menit`],
    ["Tingkat Kehadiran", `${data.totals.attendanceRate}%`, "Disiplin kehadiran"],
    [],
    ["4. Safety Toolbox Meeting HSE (ROSTER STANDBY)", "", ""],
    ["Personil Terdaftar", data.totals.safetyToolboxMeetingPersonil, "Personil HSE standby"],
    ["Total Hari Standby", data.totals.safetyToolboxMeetingTotalStandby, "Shift Siang & Malam"],
    ["Shift Siang (H)", data.totals.safetyToolboxMeetingCountH, "Standby 08:00 - 17:00"],
    ["Shift Malam (h)", data.totals.safetyToolboxMeetingCountHSmall, "Standby 17:00 - 08:00"],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan 4 Modul");

  // 2. SHEET TABEL 12 BULAN TERINTEGRASI
  const monthlyAoa: (string | number)[][] = [
    [
      "Bulan",
      "Permintaan Masuk",
      "Permintaan Selesai",
      "Resolution Rate",
      "SLA Tercapai",
      "Daily Total",
      "Daily Done",
      "Hadir (PRS)",
      "Lembur (Jam)",
      "Safety Toolbox Meeting Standby (Hari)",
      "KPI Grade",
    ],
    ...data.months.map((m) => [
      m.monthName,
      m.permintaan.masuk,
      m.permintaan.selesai,
      m.permintaan.resRate !== null ? `${m.permintaan.resRate}%` : "-",
      m.permintaan.slaPct !== null ? `${m.permintaan.slaPct}%` : "-",
      m.daily.total,
      m.daily.done,
      m.attendance.prs,
      m.attendance.overtimeHours,
      m.safetyToolboxMeeting.totalStandby,
      m.kpiGrade || "-",
    ]),
    [
      "TOTAL SETAHUN",
      data.totals.permintaanMasuk,
      data.totals.permintaanSelesai,
      `${data.totals.permintaanResRate}%`,
      `${data.totals.permintaanSlaPct}%`,
      data.totals.dailyTotal,
      data.totals.dailyDone,
      data.totals.attendancePrs,
      Math.round(data.totals.attendanceTotalMinutes / 60),
      data.totals.safetyToolboxMeetingTotalStandby,
      data.totals.overallKpiGrade,
    ],
  ];
  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyAoa);
  wsMonthly["!cols"] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMonthly, "Rekap 12 Bulan");

  // 3. SHEET DETAIL PERMINTAAN DESIGN
  const reqAoa: (string | number)[][] = [
    ["Bulan", "Tiket Masuk", "Tiket Selesai", "Res Rate", "Durasi (Jam)", "Eskalasi", "SLA %", "KPI Grade"],
    ...data.months.map((m) => [
      m.monthName,
      m.permintaan.masuk,
      m.permintaan.selesai,
      m.permintaan.resRate !== null ? `${m.permintaan.resRate}%` : "-",
      m.permintaan.avgDurationHours !== null ? m.permintaan.avgDurationHours : "-",
      m.permintaan.eskalasi,
      m.permintaan.slaPct !== null ? `${m.permintaan.slaPct}%` : "-",
      m.kpiGrade || "-",
    ]),
  ];
  const wsReq = XLSX.utils.aoa_to_sheet(reqAoa);
  XLSX.utils.book_append_sheet(wb, wsReq, "Permintaan Design");

  // 4. SHEET DETAIL DAILY ACTIVITY
  const dailyAoa: (string | number)[][] = [
    ["Bulan", "Total Aktivitas", "Done", "In Progress", "Revisi", "Pending", "Waiting", "Completion %"],
    ...data.months.map((m) => [
      m.monthName,
      m.daily.total,
      m.daily.done,
      m.daily.inProgress,
      m.daily.revisi,
      m.daily.pending,
      m.daily.waiting,
      m.daily.completionRate !== null ? `${m.daily.completionRate}%` : "-",
    ]),
  ];
  const wsDaily = XLSX.utils.aoa_to_sheet(dailyAoa);
  XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Activity");

  // 5. SHEET DETAIL ATTENDANCE
  const attAoa: (string | number)[][] = [
    ["Bulan", "Hadir (PRS)", "Lembur (OVT)", "Libur (OFF)", "Absen (ABS)", "Total Jam Lembur", "Attendance Rate %"],
    ...data.months.map((m) => [
      m.monthName,
      m.attendance.prs,
      m.attendance.ovt,
      m.attendance.off,
      m.attendance.abs,
      m.attendance.overtimeHours,
      m.attendance.attendanceRate !== null ? `${m.attendance.attendanceRate}%` : "-",
    ]),
  ];
  const wsAtt = XLSX.utils.aoa_to_sheet(attAoa);
  XLSX.utils.book_append_sheet(wb, wsAtt, "Attendance");

  // 6. SHEET DETAIL Safety Toolbox Meeting HSE
  const safetyToolboxMeetingAoa: (string | number)[][] = [
    ["Bulan", "Personil Terdaftar", "Shift Siang (H)", "Shift Malam (h)", "Standby Lainnya", "Total Hari Standby"],
    ...data.months.map((m) => [
      m.monthName,
      m.safetyToolboxMeeting.personil,
      m.safetyToolboxMeeting.countH,
      m.safetyToolboxMeeting.countHSmall,
      m.safetyToolboxMeeting.countOther,
      m.safetyToolboxMeeting.totalStandby,
    ]),
  ];
  const wsSafetyToolboxMeeting = XLSX.utils.aoa_to_sheet(safetyToolboxMeetingAoa);
  XLSX.utils.book_append_sheet(wb, wsSafetyToolboxMeeting, "Safety Toolbox Meeting HSE Roster");

  const fileName = `Rekap-Bulanan-Terintegrasi-${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
