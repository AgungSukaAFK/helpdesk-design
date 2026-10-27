"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SEARCH_MIN_QUERY,
  type PendingResponse,
  type SearchHit,
  type SearchResponse,
} from "@/lib/global-search";
import type { SearchHistory } from "./search-sections";

const DEBOUNCE_MS = 250;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 40;
const PENDING_TTL_MS = 60_000;
const HISTORY_MAX_DOCS = 5;
const HISTORY_MAX_QUERIES = 4;
const HISTORY_KEY_PREFIX = "designdesk:global-search-history:";

const EMPTY_HISTORY: SearchHistory = { docs: [], queries: [] };

// Cache di level modul supaya hapus satu huruf lalu ketik lagi tidak memicu request baru.
const cache = new Map<string, { at: number; hits: SearchHit[] }>();

function cacheGet(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.hits;
}

function cacheSet(key: string, hits: SearchHit[]) {
  cache.delete(key);
  cache.set(key, { at: Date.now(), hits });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

function readHistory(userId: string): SearchHistory {
  try {
    const raw = localStorage.getItem(HISTORY_KEY_PREFIX + userId);
    if (!raw) return EMPTY_HISTORY;
    const parsed = JSON.parse(raw);
    return {
      docs: Array.isArray(parsed.docs) ? parsed.docs.slice(0, HISTORY_MAX_DOCS) : [],
      queries: Array.isArray(parsed.queries) ? parsed.queries.slice(0, HISTORY_MAX_QUERIES) : [],
    };
  } catch {
    return EMPTY_HISTORY;
  }
}

function writeHistory(userId: string, history: SearchHistory) {
  try {
    localStorage.setItem(HISTORY_KEY_PREFIX + userId, JSON.stringify(history));
  } catch {}
}

export type SearchStatus = "idle" | "loading" | "success" | "error";

type Inflight = { q: string; promise: Promise<SearchHit[] | null>; run: () => void };

/**
 * Data global search: request dikirim 250ms setelah berhenti mengetik (min. 3 huruf),
 * request basi dibatalkan, hasil di-cache 60 detik per akun. Hasil query sebelumnya
 * tetap dikembalikan selama memuat supaya daftar tidak berkedip.
 */
export function useGlobalSearch(userId: string | null, query: string, enabled: boolean) {
  const q = query.trim();
  const [result, setResult] = useState<{ query: string; hits: SearchHit[] } | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [retryTick, setRetryTick] = useState(0);
  const [pending, setPending] = useState<PendingResponse | null>(null);
  const [history, setHistory] = useState<SearchHistory>(EMPTY_HISTORY);

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inflightRef = useRef<Inflight | null>(null);
  const pendingAtRef = useRef(0);

  const fetchHits = useCallback(
    async (term: string): Promise<SearchHit[] | null> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as SearchResponse;
        cacheSet(`${userId}\u0000${term.toLowerCase()}`, json.results);
        setResult({ query: term, hits: json.results });
        setStatus("success");
        return json.results;
      } catch {
        if (!ctrl.signal.aborted) setStatus("error");
        return null;
      }
    },
    [userId],
  );

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;

    if (!enabled || !userId || q.length < SEARCH_MIN_QUERY) {
      abortRef.current?.abort();
      inflightRef.current = null;
      setStatus("idle");
      return;
    }

    const cached = cacheGet(`${userId}\u0000${q.toLowerCase()}`);
    if (cached) {
      abortRef.current?.abort();
      setResult({ query: q, hits: cached });
      setStatus("success");
      inflightRef.current = { q, promise: Promise.resolve(cached), run: () => {} };
      return;
    }

    setStatus("loading");
    let resolve!: (hits: SearchHit[] | null) => void;
    const promise = new Promise<SearchHit[] | null>((r) => (resolve = r));
    const run = () => {
      timerRef.current = null;
      fetchHits(q).then(resolve);
    };
    inflightRef.current = { q, promise, run };
    timerRef.current = window.setTimeout(run, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [q, enabled, userId, fetchHits, retryTick]);

  /** Tunggu hasil query sekarang (dipakai saat Enter ditekan sebelum hasil datang). */
  const flush = useCallback(async () => {
    const inflight = inflightRef.current;
    if (!inflight || inflight.q !== q) return null;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      inflight.run();
    }
    return inflight.promise;
  }, [q]);

  const retry = useCallback(() => setRetryTick((t) => t + 1), []);

  /** Antrian "Perlu aksi Anda": diambil saat search dibuka, maks. 1× per menit. */
  const loadPending = useCallback(async () => {
    if (!userId || Date.now() - pendingAtRef.current < PENDING_TTL_MS) return;
    pendingAtRef.current = Date.now();
    try {
      const res = await fetch("/api/search?pending=1");
      if (res.ok) setPending((await res.json()) as PendingResponse);
    } catch {}
  }, [userId]);

  useEffect(() => {
    setHistory(userId ? readHistory(userId) : EMPTY_HISTORY);
    setPending(null);
    pendingAtRef.current = 0;
  }, [userId]);

  /** Simpan dokumen yang dibuka & query yang menghasilkan sesuatu yang dibuka. */
  const remember = useCallback(
    (hit: SearchHit | null, term: string) => {
      if (!userId) return;
      setHistory((prev) => {
        const t = term.trim();
        const next: SearchHistory = {
          docs: hit
            ? [hit, ...prev.docs.filter((d) => !(d.kind === hit.kind && d.id === hit.id))].slice(0, HISTORY_MAX_DOCS)
            : prev.docs,
          queries: t
            ? [t, ...prev.queries.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, HISTORY_MAX_QUERIES)
            : prev.queries,
        };
        writeHistory(userId, next);
        return next;
      });
    },
    [userId],
  );

  const clearHistory = useCallback(() => {
    if (!userId) return;
    writeHistory(userId, EMPTY_HISTORY);
    setHistory(EMPTY_HISTORY);
  }, [userId]);

  return {
    /** Hasil server terakhir (bisa milik query sebelumnya selama memuat). */
    hits: q.length >= SEARCH_MIN_QUERY ? result?.hits ?? null : null,
    hitsQuery: result?.query ?? null,
    status,
    flush,
    retry,
    pending,
    loadPending,
    history,
    remember,
    clearHistory,
  };
}
