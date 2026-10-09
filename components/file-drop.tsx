"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, FileUp, Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Cocokkan file dengan atribut `accept` ala <input type="file">. */
export function matchesAccept(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith(".")) return name.endsWith(rule);
      if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
}

/** Label singkat dari `accept`, mis. ".xlsx,.csv" → "XLSX, CSV". */
export function describeAccept(accept?: string) {
  if (!accept) return "Semua jenis file";
  return accept
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      if (a.startsWith(".")) return a.slice(1).toUpperCase();
      if (a === "image/*") return "Gambar";
      if (a === "audio/*") return "Audio";
      if (a === "video/*") return "Video";
      return (a.split("/")[1] ?? a).toUpperCase();
    })
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Gambar hasil tempel dari clipboard selalu bernama "image.png" — beri nama
 * unik agar tidak bentrok dengan lampiran lain yang dibedakan berdasarkan nama.
 */
function renamePasted(file: File, index: number) {
  const d = new Date();
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const suffix = index > 0 ? `-${index + 1}` : "";
  return new File([file], `tempel-${stamp}${suffix}.${ext}`, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

function hasFiles(e: DragEvent | React.DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

interface FileFilterOptions {
  accept?: string;
  multiple?: boolean;
}

/** Saring file sesuai accept/multiple dan beri tahu pengguna bila ada yang ditolak. */
function filterFiles(files: File[], { accept, multiple = true }: FileFilterOptions) {
  const valid = files.filter((f) => matchesAccept(f, accept));
  const rejected = files.length - valid.length;
  if (rejected > 0) {
    toast.error(
      valid.length === 0
        ? `Jenis file tidak didukung. Gunakan: ${describeAccept(accept)}.`
        : `${rejected} file dilewati karena jenisnya tidak didukung (${describeAccept(accept)}).`,
    );
  }
  if (!multiple && valid.length > 1) {
    toast.info("Hanya satu file yang dapat diunggah, file pertama yang dipakai.");
    return valid.slice(0, 1);
  }
  return valid;
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

interface UseFileDropOptions extends FileFilterOptions {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

/** Drag & drop pada satu elemen. Sebarkan `dropProps` ke elemen tersebut. */
export function useFileDrop({ onFiles, accept, multiple, disabled }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    if (disabled) {
      depth.current = 0;
      setIsDragging(false);
    }
  }, [disabled]);

  const dropProps = {
    onDragEnter: (e: React.DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setIsDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: React.DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setIsDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setIsDragging(false);
      // Area bersarang: biarkan event naik agar overlay induk ikut tertutup,
      // tapi file hanya diproses oleh zona terdalam.
      const native = e.nativeEvent as DragEvent & { __fileDropHandled?: boolean };
      if (native.__fileDropHandled) return;
      native.__fileDropHandled = true;
      const files = filterFiles(Array.from(e.dataTransfer.files), { accept, multiple });
      if (files.length) onFiles(files);
    },
  };

  return { isDragging, dropProps };
}

interface UsePasteFilesOptions extends FileFilterOptions {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Tangkap Ctrl+V berisi file/gambar di seluruh halaman. Paste teks biasa
 * tidak terpengaruh, dan paste yang sudah ditangani elemen lain (mis. editor)
 * diabaikan.
 */
export function usePasteFiles({ onFiles, accept, multiple, disabled }: UsePasteFilesOptions) {
  const latest = useRef({ onFiles, accept, multiple });
  latest.current = { onFiles, accept, multiple };

  useEffect(() => {
    if (disabled) return;
    const handler = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const raw = Array.from(e.clipboardData?.files ?? []);
      if (raw.length === 0) return;
      e.preventDefault();
      const { onFiles, accept, multiple } = latest.current;
      const files = filterFiles(raw.map(renamePasted), { accept, multiple });
      if (files.length) onFiles(files);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [disabled]);
}

/** Ambil file dari event paste (untuk dipakai di handler paste milik komponen lain). */
export function filesFromClipboard(data: DataTransfer | null) {
  return Array.from(data?.files ?? []).map(renamePasted);
}

/* ------------------------------------------------------------------ */
/* Komponen                                                            */
/* ------------------------------------------------------------------ */

interface FileDropzoneProps extends FileFilterOptions {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Aktifkan Ctrl+V untuk menempel file/gambar dari clipboard. */
  paste?: boolean;
  /** Keterangan tambahan, mis. batas ukuran. */
  hint?: string;
  id?: string;
  className?: string;
}

/** Kotak unggah: klik untuk memilih, tarik & lepas, atau tempel (Ctrl+V). */
export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  disabled,
  loading,
  paste = true,
  hint,
  id,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inactive = disabled || loading;
  const { isDragging, dropProps } = useFileDrop({ onFiles, accept, multiple, disabled: inactive });
  usePasteFiles({ onFiles, accept, multiple, disabled: inactive || !paste });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterFiles(Array.from(e.target.files ?? []), { accept, multiple });
    e.target.value = "";
    if (files.length) onFiles(files);
  };

  return (
    <div
      {...dropProps}
      role="button"
      tabIndex={inactive ? -1 : 0}
      aria-disabled={inactive}
      onClick={() => !inactive && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!inactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        isDragging
          ? "border-primary bg-primary/10 text-primary"
          : "border-muted-foreground/25 bg-muted/20 text-muted-foreground hover:border-primary/50 hover:bg-muted/40",
        inactive ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={inactive}
        onChange={handleChange}
      />
      {loading ? (
        <Loader2 className="h-7 w-7 animate-spin" />
      ) : (
        <UploadCloud className={cn("h-7 w-7", isDragging && "animate-bounce")} />
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {loading
            ? "Mengunggah…"
            : isDragging
              ? "Lepaskan file di sini"
              : (
                <>
                  Tarik &amp; lepas {multiple ? "file" : "satu file"} ke sini, atau{" "}
                  <span className="text-primary underline underline-offset-2">pilih file</span>
                </>
              )}
        </p>
        {paste && !loading && !isDragging && (
          <p className="flex items-center justify-center gap-1 text-xs">
            <ClipboardPaste className="h-3.5 w-3.5" />
            Bisa juga tempel gambar / screenshot dengan{" "}
            <kbd className="rounded border bg-background px-1 font-mono text-[10px]">Ctrl</kbd>+
            <kbd className="rounded border bg-background px-1 font-mono text-[10px]">V</kbd>
          </p>
        )}
        <p className="text-xs">
          {describeAccept(accept)}
          {multiple ? " · bisa beberapa file sekaligus" : ""}
          {hint ? ` · ${hint}` : ""}
        </p>
      </div>
    </div>
  );
}

interface FileDropAreaProps extends FileFilterOptions {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  /** Aktifkan Ctrl+V untuk menempel file/gambar dari clipboard. */
  paste?: boolean;
  /** Teks pada overlay saat file sedang ditarik. */
  label?: string;
  className?: string;
  children: React.ReactNode;
}

/** Bungkus area yang sudah ada agar bisa menerima drop; tampilkan overlay saat menarik file. */
export function FileDropArea({
  onFiles,
  accept,
  multiple = true,
  disabled,
  paste = false,
  label = "Lepaskan file untuk mengunggah",
  className,
  children,
}: FileDropAreaProps) {
  const { isDragging, dropProps } = useFileDrop({ onFiles, accept, multiple, disabled });
  usePasteFiles({ onFiles, accept, multiple, disabled: disabled || !paste });

  return (
    <div {...dropProps} className={cn("relative", className)}>
      {children}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-primary bg-primary/10 p-3 text-center text-primary backdrop-blur-[1px]">
          <UploadCloud className="h-7 w-7 animate-bounce" />
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs opacity-80">{describeAccept(accept)}</p>
        </div>
      )}
    </div>
  );
}

interface PageFileDropProps extends FileFilterOptions {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  /** Judul overlay, mis. "Lepaskan file Excel untuk import". */
  label: string;
  description?: string;
}

/**
 * Drop di mana saja pada halaman (mis. untuk import Excel). Menampilkan
 * overlay layar penuh selama file ditarik di atas jendela.
 */
export function PageFileDrop({
  onFiles,
  accept,
  multiple = false,
  disabled,
  label,
  description,
}: PageFileDropProps) {
  const [isDragging, setIsDragging] = useState(false);
  const depth = useRef(0);
  const latest = useRef({ onFiles, accept, multiple });
  latest.current = { onFiles, accept, multiple };

  const reset = useCallback(() => {
    depth.current = 0;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (disabled) {
      reset();
      return;
    }
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setIsDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      reset();
      if ((e as DragEvent & { __fileDropHandled?: boolean }).__fileDropHandled) return;
      const { onFiles, accept, multiple } = latest.current;
      const files = filterFiles(Array.from(e.dataTransfer?.files ?? []), { accept, multiple });
      if (files.length) onFiles(files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    // Drop yang ditangani elemen lain (stopPropagation) tetap harus menutup overlay
    window.addEventListener("drop", reset, true);
    window.addEventListener("dragend", reset);
    return () => {
      window.removeEventListener("drop", reset, true);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [disabled, reset]);

  if (!isDragging) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card p-8 text-center shadow-xl">
        <FileUp className="h-10 w-10 animate-bounce text-primary" />
        <p className="text-lg font-semibold">{label}</p>
        <p className="text-sm text-muted-foreground">
          {description ?? `Format yang didukung: ${describeAccept(accept)}`}
        </p>
      </div>
    </div>
  );
}

/** Teks petunjuk kecil di bawah tombol import. */
export function DropHint({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <FileUp className="h-3.5 w-3.5 shrink-0" />
      {children ?? "Tips: tarik & lepas file Excel/CSV ke mana saja di halaman ini untuk import."}
    </p>
  );
}
