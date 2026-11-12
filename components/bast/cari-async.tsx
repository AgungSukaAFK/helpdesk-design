"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

/**
 * Combobox dengan pencarian di server (/api/bast/cari): saat dibuka tampil
 * 20 data terbaru, saat mengetik tampil maks. 20 hasil yang cocok.
 * Lebar popover = lebar tombol; teks panjang dipotong, tidak melebarkan elemen.
 */
export function CariAsync<T extends { id: string }>({
  tipe,
  trigger,
  placeholder = "Cari...",
  terpilih = [],
  onPilih,
  label,
  detail,
  tetapBuka = false,
}: {
  tipe: "permintaan" | "user";
  trigger: React.ReactNode;
  placeholder?: string;
  terpilih?: string[];
  onPilih: (item: T) => void;
  label: (item: T) => string;
  detail?: (item: T) => React.ReactNode;
  /** Popover tetap terbuka setelah memilih (untuk pilihan ganda). */
  tetapBuka?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const urut = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++urut.current;
    setLoading(true);
    const t = setTimeout(
      () => {
        fetch(`/api/bast/cari?tipe=${tipe}&q=${encodeURIComponent(q.trim())}`)
          .then((res) => (res.ok ? res.json() : { data: [] }))
          .then((json) => id === urut.current && setItems(json.data ?? []))
          .catch(() => id === urut.current && setItems([]))
          .finally(() => id === urut.current && setLoading(false));
      },
      q ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [open, q, tipe]);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQ("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={q} onValueChange={setQ} className="h-9" />
          <CommandList className="max-h-72">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Mencari...
              </div>
            ) : (
              <CommandEmpty>
                <span className="inline-flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" /> Tidak ditemukan.
                </span>
              </CommandEmpty>
            )}
            {items.length > 0 && (
              <CommandGroup heading={q.trim() ? `Hasil (maks. 20)${loading ? " · mencari..." : ""}` : "20 terbaru"}>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      onPilih(item);
                      if (!tetapBuka) setOpen(false);
                    }}
                    className="items-start"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 break-words" title={label(item)}>
                        {label(item)}
                      </div>
                      {detail && <div className="truncate text-xs text-muted-foreground">{detail(item)}</div>}
                    </div>
                    <Check
                      className={cn("ml-2 mt-0.5 h-4 w-4 shrink-0", terpilih.includes(item.id) ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
