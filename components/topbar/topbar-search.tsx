"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Loader2, RotateCcw, Search, SearchX, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { buildNavGroups } from "@/lib/sidebar/nav-config";
import { splitHighlight } from "@/lib/sidebar/menu-search";
import { SEARCH_MIN_QUERY, type SearchHit } from "@/lib/global-search";
import { runViewTransition } from "@/lib/view-transition";
import { cn } from "@/lib/utils";
import { buildSections, type SearchItem, type SearchSection } from "./search-sections";
import { useGlobalSearch, type SearchStatus } from "./use-global-search";
import { TopbarIconButton } from "./topbar-icon-button";
import { useTopbarProfileData } from "./topbar";

const PLACEHOLDER = "Cari permintaan, artikel, menu…";

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  return (
    <>
      {splitHighlight(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-sm bg-primary/15 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function StateMessage({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}

type ResultsProps = {
  listId: string;
  sections: SearchSection[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onRun: (item: SearchItem) => void;
  query: string;
  status: SearchStatus;
  hasHits: boolean;
  profileLoading: boolean;
  hasHistory: boolean;
  onRetry: () => void;
  onClearHistory: () => void;
};

function SearchResults({
  listId,
  sections,
  activeIndex,
  setActiveIndex,
  onRun,
  query,
  status,
  hasHits,
  profileLoading,
  hasHistory,
  onRetry,
  onClearHistory,
}: ResultsProps) {
  const q = query.trim();

  useEffect(() => {
    document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [listId, activeIndex]);

  if (profileLoading) {
    return (
      <StateMessage icon={<Loader2 className="size-5 animate-spin" />}>Memuat…</StateMessage>
    );
  }

  let index = -1;
  const isEmpty = sections.length === 0;

  return (
    <div id={listId} role="listbox" aria-label="Hasil pencarian" className="p-1.5">
      {!q && !hasHistory && (
        <p className="px-2 pb-1 pt-1.5 text-xs text-muted-foreground">
          Ketik judul permintaan, nama project, artikel, atau menu.
        </p>
      )}

      {sections.map((section) => {
        const labelId = `${listId}-group-${section.id}`;
        return (
          <div key={section.id} role="group" aria-labelledby={labelId} className="mb-1 last:mb-0">
            <div className="flex items-center justify-between px-2 pb-1 pt-2">
              <span id={labelId} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </span>
              {(section.id === "recent-docs" ||
                (section.id === "recent-queries" && !sections.some((s) => s.id === "recent-docs"))) && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Hapus riwayat
                </button>
              )}
            </div>
            {section.items.map((item) => {
              index += 1;
              const i = index;
              const active = i === activeIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={active}
                  onMouseMove={() => !active && setActiveIndex(i)}
                  onClick={() => onRun(item)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5",
                    active && "bg-accent",
                    item.muted && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-md border bg-background",
                      item.muted && "border-dashed",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", !item.muted && "font-medium")}>
                      {item.muted ? item.title : <Highlight text={item.title} query={q} />}
                    </span>
                    {item.subtitle && (
                      <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                    )}
                  </span>
                  {item.pill && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        item.pill.className,
                      )}
                    >
                      {item.pill.label}
                    </span>
                  )}
                  {item.meta && <span className="shrink-0 text-[11px] text-muted-foreground">{item.meta}</span>}
                </div>
              );
            })}
          </div>
        );
      })}

      {q.length > 0 && q.length < SEARCH_MIN_QUERY && (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          Ketik minimal {SEARCH_MIN_QUERY} huruf untuk mencari permintaan, artikel, dan user.
        </p>
      )}
      {q.length >= SEARCH_MIN_QUERY && status === "loading" && !hasHits && (
        <StateMessage icon={<Loader2 className="size-5 animate-spin" />}>Mencari…</StateMessage>
      )}
      {q.length >= SEARCH_MIN_QUERY && status === "error" && (
        <StateMessage>
          Pencarian data gagal dimuat.
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw />
            Coba lagi
          </Button>
        </StateMessage>
      )}
      {q.length >= SEARCH_MIN_QUERY && status === "success" && isEmpty && (
        <StateMessage icon={<SearchX className="size-6 opacity-60" />}>
          Tidak ada hasil untuk &ldquo;{q}&rdquo;
        </StateMessage>
      )}
    </div>
  );
}

function ShortcutHint({ isMac }: { isMac: boolean }) {
  return (
    <kbd className="pointer-events-none hidden select-none items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline-flex">
      {isMac ? "⌘" : "Ctrl"} K
    </kbd>
  );
}

/**
 * Global search (⌘K / Ctrl K). lg ke atas: field inline + panel popover;
 * di bawah lg: tombol ikon yang membuka dialog menempel di atas layar.
 */
export function TopbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { profile, loading: profileLoading, logout } = useTopbarProfileData();

  const [query, setQuery] = useState("");
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineFocused, setInlineFocused] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isMac, setIsMac] = useState<boolean | null>(null);

  const inlineInputRef = useRef<HTMLInputElement>(null);
  const dialogInputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const open = inlineOpen || dialogOpen;
  const search = useGlobalSearch(profile?.id ?? null, query, open);
  const { loadPending } = search;
  const navGroups = useMemo(() => buildNavGroups(profile?.role), [profile?.role]);

  const makeSections = useCallback(
    (hits: SearchHit[] | null) =>
      profile
        ? buildSections({
            query,
            role: profile.role,
            navGroups,
            theme,
            hits,
            pending: search.pending,
            history: search.history,
          })
        : [],
    [profile, query, navGroups, theme, search.pending, search.history],
  );
  const sections = useMemo(() => makeSections(search.hits), [makeSections, search.hits]);
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  // Pilihan kembali ke item teratas tiap query/hasil berubah.
  useEffect(() => setActiveIndex(0), [sections]);

  useEffect(() => {
    if (open) void loadPending();
  }, [open, loadPending]);

  useEffect(() => {
    setInlineOpen(false);
    setDialogOpen(false);
  }, [pathname]);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const inline = inlineInputRef.current;
        // offsetParent null = field inline sedang disembunyikan (di bawah lg).
        if (inline && inline.offsetParent !== null) {
          inline.focus();
          inline.select();
          setInlineOpen(true);
        } else {
          setDialogOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = useCallback(() => {
    setInlineOpen(false);
    setDialogOpen(false);
    setQuery("");
    inlineInputRef.current?.blur();
  }, []);

  const runItem = useCallback(
    (item: SearchItem) => {
      const run = item.run;
      switch (run.type) {
        case "fill":
          setQuery(run.query);
          (dialogOpen ? dialogInputRef : inlineInputRef).current?.focus();
          return;
        case "navigate":
          search.remember(item.hit ?? null, query);
          close();
          router.push(run.href);
          return;
        case "theme":
          close();
          runViewTransition(() => setTheme(run.value), { mode: "reveal" });
          return;
        case "logout":
          close();
          setLogoutOpen(true);
          return;
      }
    },
    [dialogOpen, search, query, close, router, setTheme],
  );

  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!inlineOpen && !dialogOpen) setInlineOpen(true);
      if (flat.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + step + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      // Enter sebelum hasil server datang (mis. tempel judul lalu Enter): tunggu, lalu buka yang teratas.
      if (activeIndex === 0 && q.length >= SEARCH_MIN_QUERY && (search.status === "loading" || search.hitsQuery !== q)) {
        const hits = await search.flush();
        if (hits) {
          const top = makeSections(hits).flatMap((s) => s.items)[0];
          if (top) runItem(top);
          return;
        }
      }
      const item = flat[activeIndex];
      if (item) runItem(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const inputProps = {
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": flat.length > 0 ? `${listId}-opt-${activeIndex}` : undefined,
    autoComplete: "off",
    spellCheck: false,
    value: query,
    placeholder: PLACEHOLDER,
    onKeyDown,
  };

  const resultsProps: Omit<ResultsProps, "listId"> = {
    sections,
    activeIndex,
    setActiveIndex,
    onRun: runItem,
    query,
    status: search.status,
    hasHits: search.hits !== null,
    profileLoading,
    hasHistory: search.history.docs.length > 0 || search.history.queries.length > 0,
    onRetry: search.retry,
    onClearHistory: search.clearHistory,
  };

  const searching = search.status === "loading" && query.trim().length >= SEARCH_MIN_QUERY;
  const LeadingIcon = searching ? Loader2 : Search;

  return (
    <>
      {/* Desktop: field inline */}
      <Popover open={inlineOpen} onOpenChange={setInlineOpen}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative hidden w-full lg:block">
            <LeadingIcon
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground",
                searching && "animate-spin",
              )}
            />
            <input
              ref={inlineInputRef}
              role="combobox"
              aria-controls={listId}
              aria-expanded={inlineOpen}
              {...inputProps}
              aria-label="Global search"
              onChange={(e) => {
                setQuery(e.target.value);
                setInlineOpen(true);
              }}
              onFocus={() => {
                setInlineFocused(true);
                setInlineOpen(true);
              }}
              onBlur={() => {
                setInlineFocused(false);
                setInlineOpen(false);
              }}
              className="h-9 w-full rounded-full border border-transparent bg-muted/40 pl-9 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted/60 focus:border-ring/40 focus:bg-background focus:ring-2 focus:ring-ring/20"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
              {query ? (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setQuery("")}
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                !inlineFocused && isMac !== null && <ShortcutHint isMac={isMac} />
              )}
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="center"
          sideOffset={8}
          collisionPadding={8}
          className="flex max-h-[min(32rem,calc(100dvh-6rem))] w-[min(34rem,calc(100vw-2rem))] flex-col p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // Klik di panel tidak boleh mencuri fokus dari input.
          onMouseDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SearchResults listId={listId} {...resultsProps} />
          </div>
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              <kbd className="font-sans">↑↓</kbd> pilih
            </span>
            <span>
              <kbd className="font-sans">Enter</kbd> buka
            </span>
            <span>
              <kbd className="font-sans">Esc</kbd> tutup
            </span>
          </div>
        </PopoverContent>
      </Popover>

      {/* Mobile & tablet: tombol ikon + dialog di atas layar (tidak tertutup keyboard virtual) */}
      <TopbarIconButton label="Global Search" className="lg:hidden" onClick={() => setDialogOpen(true)}>
        <Search />
      </TopbarIconButton>
      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-3 flex max-h-[calc(100dvh-1.5rem)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:top-[12vh] sm:max-h-[min(36rem,80dvh)] sm:max-w-xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            dialogInputRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Global search</DialogTitle>
          <div className="flex items-center gap-2 border-b p-2">
            <div className="relative flex-1">
              <LeadingIcon
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground",
                  searching && "animate-spin",
                )}
              />
              <input
                ref={dialogInputRef}
                role="combobox"
                aria-controls={listId}
                aria-expanded={dialogOpen}
                {...inputProps}
                aria-label="Global search"
                enterKeyHint="search"
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-md bg-muted/40 pl-9 pr-9 text-base outline-none focus:bg-background focus:ring-2 focus:ring-ring/20 sm:text-sm"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => {
                    setQuery("");
                    dialogInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={close}>
              Batal
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {dialogOpen && <SearchResults listId={listId} {...resultsProps} />}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Keluar dari akun?"
        description="Anda perlu login lagi untuk membuka DesignDesk."
        confirmText="Log out"
        destructive
        onConfirm={logout}
      />
    </>
  );
}
