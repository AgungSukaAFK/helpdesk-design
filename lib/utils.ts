import { clsx, type ClassValue } from "clsx";
import { isValid, parse } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function formatTanggal(timestamp: number | string): string {
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const bulan = [
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

  let date: Date | null = null;

  if (typeof timestamp === "number") {
    date = new Date(timestamp);
  } else if (typeof timestamp === "string") {
    // Coba parse ISOString terlebih dahulu
    const isoDate = new Date(timestamp);
    if (isValid(isoDate)) {
      date = isoDate;
    } else {
      // Jika bukan ISOString, parse dengan format d/M/yyyy
      const parsed = parse(timestamp, "d/M/yyyy", new Date());
      if (isValid(parsed)) {
        date = parsed;
      }
    }
  }

  if (date && isValid(date)) {
    const hariNama = hari[date.getDay()];
    const tanggal = date.getDate();
    const bulanNama = bulan[date.getMonth()];
    const tahun = date.getFullYear();
    return `${hariNama}, ${tanggal} ${bulanNama} ${tahun}`;
  }

  return "Tanggal tidak valid";
}

export function parseCSV(csv: string): string[][] {
  return csv
    .trim()
    .split("\n")
    .map(
      (line) => line.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim()) // buang tanda kutip
    );
}

export function validateCSV(csv: string) {
  const rows = parseCSV(csv);
  const [header, ...data] = rows;

  const expected = ["part_number", "part_name", "category", "uom", "vendor"];
  if (header.join(",") !== expected.join(",")) {
    return { valid: false, errors: ["Header CSV tidak sesuai"], rows: [] };
  }

  const seen = new Set<string>();
  const uniqueRows: string[][] = [];
  const errors: string[] = [];

  data.forEach((cols, i) => {
    const partNumber = cols[0];
    if (!partNumber) {
      errors.push(`Baris ${i + 2}: part_number kosong`);
      return;
    }
    if (seen.has(partNumber)) {
      errors.push(`Duplikat di CSV pada baris ${i + 2}: ${partNumber}`);
      return;
    }
    seen.add(partNumber);
    uniqueRows.push(cols);
  });

  return { valid: errors.length === 0, errors, rows: uniqueRows };
}

/** Tanggal hari ini (zona waktu browser) dalam format YYYY-MM-DD */
export function getTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Geser tanggal YYYY-MM-DD sebanyak `days` hari (boleh negatif) */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "2026-10-27" -> "27 Okt 2026" */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthName = monthNames[parseInt(m, 10) - 1] || m;
  return `${d} ${monthName} ${y}`;
}

/** Nama sheet Excel: maks 31 karakter dan tanpa karakter \ / ? * [ ] : */
export function toSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "-").trim().slice(0, 31) || "Sheet1";
}
