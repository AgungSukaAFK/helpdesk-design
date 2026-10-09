"use client";

// Satu ringtone per device, tidak pernah di-upload ke server.
const DB_NAME = "designdesk-notif-custom-sound";
const STORE_NAME = "sound";
const RECORD_KEY = "current";

export interface CustomSoundRecord { blob: Blob; name: string; duration: number; savedAt: number; }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomSound(blob: Blob, name: string, duration: number) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ blob, name, duration, savedAt: Date.now() }, RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  resetCachedUrl();
}

export async function getCustomSound(): Promise<CustomSoundRecord | null> {
  const db = await openDb();
  const result = await new Promise<CustomSoundRecord | null>((resolve, reject) => {
    const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(RECORD_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteCustomSound() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  resetCachedUrl();
}

// Cache object URL supaya tiap notif tidak baca IndexedDB ulang.
let cachedUrlPromise: Promise<string | null> | null = null;

function resetCachedUrl() {
  const previous = cachedUrlPromise;
  cachedUrlPromise = null;
  previous?.then((url) => url && URL.revokeObjectURL(url)).catch(() => {});
}

export function getCustomSoundUrl(): Promise<string | null> {
  if (!cachedUrlPromise) {
    cachedUrlPromise = getCustomSound()
      .then((rec) => (rec ? URL.createObjectURL(rec.blob) : null))
      .catch(() => null);
  }
  return cachedUrlPromise;
}
