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
    review: number;
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
    dailyReview: number;
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
          review: 0,
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
      dailyReview: 0,
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
