export interface AttendanceRecord {
  id: string;
  no: number;
  period_month: string; // Format: YYYY-MM (e.g. "2026-08")
  employee_no: string;
  name: string;
  date: string;
  shift: string;
  start_time: string;
  end_time: string;
  status: string;
  overtime: number;
  overtime_index: string;
  created_at?: string;
}

export function extractPeriodMonth(dateStr: string): string {
  if (!dateStr) return "";
  const text = String(dateStr).trim();

  // 1. ISO format: 2026-08-31
  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}`;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY format: 31/08/2026
  const dmyMatch = text.match(/^\d{1,2}[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[2]}-${dmyMatch[1].padStart(2, "0")}`;
  }

  // 3. Text date: "Mon, 31 Aug 2026" or "31 Agustus 2026"
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", mei: "05",
    jun: "06", jul: "07", aug: "08", agu: "08", sep: "09", okt: "10",
    oct: "10", nov: "11", nop: "11", des: "12", dec: "12",
  };

  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : "";

  for (const [k, v] of Object.entries(monthMap)) {
    const re = new RegExp(`\\b${k}`, "i");
    if (re.test(text)) {
      return year ? `${year}-${v}` : "";
    }
  }

  return "";
}

export function formatPeriodMonth(period: string): string {
  if (!period || !period.includes("-")) return period || "-";
  const [year, month] = period.split("-");
  const monthNames: Record<string, string> = {
    "01": "Januari",
    "02": "Februari",
    "03": "Maret",
    "04": "April",
    "05": "Mei",
    "06": "Juni",
    "07": "Juli",
    "08": "Agustus",
    "09": "September",
    "10": "Oktober",
    "11": "November",
    "12": "Desember",
  };
  return `${monthNames[month] || month} ${year}`;
}

const RAW_INITIAL_DATA: Omit<AttendanceRecord, "period_month">[] = [];

export const INITIAL_ATTENDANCE_DATA: AttendanceRecord[] = RAW_INITIAL_DATA.map((item) => ({
  ...item,
  period_month: extractPeriodMonth(item.date) || "2026-08",
}));

/**
 * Periode yang memiliki data presensi baseline asli (hasil import Excel).
 * Hanya periode ini yang boleh diisi otomatis. Bulan lain harus berasal dari
 * import Excel, jika tidak rekap akan menampilkan angka palsu.
 */
export const ATTENDANCE_BASELINE_PERIODS = ["2026-08"] as const;

/**
 * Data presensi untuk satu periode.
 *
 * Hanya periode baseline (ATTENDANCE_BASELINE_PERIODS) yang boleh diisi otomatis.
 * Periode lain wajib berasal dari import Excel sehingga bulan tanpa aktivitas
 * tetap kosong dan rekap menampilkan 0.
 */
export function getAttendanceSeedForPeriod(period: string): AttendanceRecord[] {
  if (!(ATTENDANCE_BASELINE_PERIODS as readonly string[]).includes(period)) {
    return [];
  }
  return INITIAL_ATTENDANCE_DATA.filter((r) => r.period_month === period);
}

/**
 * Dapatkan seluruh data presensi baseline satu tahun (hanya periode baseline).
 */
export function getAllAttendanceSeedData(year: number = 2026): AttendanceRecord[] {
  const result: AttendanceRecord[] = [];
  for (const period of ATTENDANCE_BASELINE_PERIODS) {
    if (!period.startsWith(`${year}-`)) continue;
    result.push(...getAttendanceSeedForPeriod(period));
  }
  return result;
}

