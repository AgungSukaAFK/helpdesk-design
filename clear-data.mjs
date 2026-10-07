import fs from "node:fs";

const TABLES = [
  "komentar",
  "permintaan",
  "attendance",
  "daily_activities",
  "safety_toolbox_meeting_hse_roster",
  "notifications",
];

function loadEnv() {
  const raw = fs.readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  const get = (k) => raw.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
  const url = get("NEXT_PUBLIC_SUPABASE_URL");
  const key = get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env.local");
  return { url, key };
}

const { url, key } = loadEnv();

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

try {
  const probe = await fetch(`${url}/auth/v1/health`, { headers });
  if (!probe.ok) console.warn(`Peringatan: health check HTTP ${probe.status}`);
} catch (err) {
  console.error(`Tidak bisa menghubungi ${url}`);
  console.error(`  ${err.cause?.code || err.message} — project Supabase kemungkinan paused/dihapus, atau URL di .env.local sudah tidak berlaku.`);
  process.exit(1);
}

async function count(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

async function clear(table) {
  const before = await count(table);
  let res = await fetch(`${url}/rest/v1/${table}?id=not.is.null`, {
    method: "DELETE",
    headers,
  });
  if (res.status === 400 || res.status === 404) {
    res = await fetch(`${url}/rest/v1/${table}`, { method: "DELETE", headers });
  }
  if (!res.ok) throw new Error(`${table}: gagal dihapus — HTTP ${res.status} ${await res.text()}`);
  const after = await count(table);
  console.log(`${table}: ${before} -> ${after} baris`);
}

let failed = false;
for (const table of TABLES) {
  try {
    await clear(table);
  } catch (err) {
    failed = true;
    console.error(`GAGAL ${table}: ${err.message}`);
  }
}
if (failed) {
  console.error("\nSebagian tabel gagal dibersihkan. Cek koneksi/URL Supabase di .env.local.");
  process.exit(1);
}
console.log("\nSemua tabel berhasil dikosongkan.");
