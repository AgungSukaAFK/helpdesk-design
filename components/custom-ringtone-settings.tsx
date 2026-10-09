"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Mic, Music, Play, Square, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropArea } from "@/components/file-drop";
import { cn } from "@/lib/utils";
import { useNotifSettings } from "@/lib/notifications/settings";
import { playCustomSound, unlockAudio } from "@/lib/notifications/sound";
import {
  deleteCustomSound, getCustomSound, saveCustomSound, type CustomSoundRecord,
} from "@/lib/notifications/custom-sound-db";

const MAX_SECONDS = 30;
const MAX_BYTES = 8 * 1024 * 1024;

type Draft = { blob: Blob; name: string; duration: number; url: string };

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function readDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      // Rekaman webm kadang melaporkan Infinity sampai di-seek.
      if (audio.duration === Infinity) {
        audio.currentTime = 1e101;
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null;
          URL.revokeObjectURL(url);
          resolve(audio.duration);
        };
        return;
      }
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Audio tidak dapat dibaca."));
    };
    audio.src = url;
  });
}

function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return undefined;
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return undefined;
}

export function CustomRingtoneSettings({ disabled }: { disabled?: boolean }) {
  const { settings, update } = useNotifSettings();
  const [saved, setSaved] = useState<CustomSoundRecord | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  const isActive = settings.soundType === "custom";

  useEffect(() => {
    getCustomSound().then(setSaved).catch(() => setSaved(null));
  }, []);

  // Bersihkan object URL draft & rekaman yang masih jalan saat unmount.
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);
  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);

  const setDraftFromBlob = async (blob: Blob, name: string) => {
    if (blob.size > MAX_BYTES) {
      toast.error("Ukuran audio maksimal 8 MB.");
      return;
    }
    try {
      const duration = await readDuration(blob);
      if (!Number.isFinite(duration) || duration > MAX_SECONDS + 1) {
        toast.error(`Durasi audio maksimal ${MAX_SECONDS} detik.`);
        return;
      }
      setDraft({ blob, name, duration, url: URL.createObjectURL(blob) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat audio.");
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("File harus berupa audio.");
      return;
    }
    void setDraftFromBlob(file, file.name);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Rekam suara tidak didukung browser ini.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setRecording(false);
        const type = recorder.mimeType || mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : "webm";
        void setDraftFromBlob(new Blob(chunks, { type }), `Rekaman suara.${ext}`);
      };
      recorder.start();
      setRecording(true);
      setElapsed(0);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const secs = (Date.now() - startedAt) / 1000;
        setElapsed(secs);
        if (secs >= MAX_SECONDS && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch {
      toast.error("Izin mikrofon ditolak atau tidak tersedia.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const saveDraft = async () => {
    if (!draft) return;
    try {
      await saveCustomSound(draft.blob, draft.name, draft.duration);
      setSaved(await getCustomSound());
      setDraft(null);
      update({ soundType: "custom" });
      toast.success("Ringtone tersimpan dan dipakai di perangkat ini.");
    } catch {
      toast.error("Gagal menyimpan ringtone di perangkat ini.");
    }
  };

  const removeSaved = async () => {
    try {
      await deleteCustomSound();
      setSaved(null);
      if (isActive) update({ soundType: "tritone" });
      toast.success("Ringtone custom dihapus.");
    } catch {
      toast.error("Gagal menghapus ringtone.");
    }
  };

  const playSaved = async () => {
    unlockAudio();
    if (!(await playCustomSound(settings.volume))) {
      toast.error("Browser memblokir pemutaran suara.");
    }
  };

  return (
    <FileDropArea
      onFiles={(files) => handleFile(files[0])}
      accept="audio/*"
      multiple={false}
      disabled={disabled}
      label="Lepaskan file audio untuk dijadikan ringtone"
      className="space-y-3 rounded-lg"
    >
      <div>
        <p className="text-sm font-medium">Ringtone Custom</p>
        <p className="text-xs text-muted-foreground">
          Upload file audio atau rekam suara langsung, maks {MAX_SECONDS} detik. Tersimpan lokal di perangkat ini saja
          (tidak diunggah ke server) - perlu di-set ulang kalau ganti device/browser. File audio juga bisa langsung
          ditarik &amp; dilepas ke bagian ini.
        </p>
      </div>

      {draft ? (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium">{draft.name}</span>
            <span className="shrink-0 text-muted-foreground">{formatDuration(draft.duration)}</span>
          </div>
          <audio controls src={draft.url} className="h-9 w-full" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDraft(null)}>
              <X className="h-3.5 w-3.5" /> Batal
            </Button>
            <Button type="button" size="sm" onClick={saveDraft}>
              <Check className="h-3.5 w-3.5" /> Simpan &amp; Gunakan
            </Button>
          </div>
        </div>
      ) : saved ? (
        <div className={cn("flex items-center gap-3 rounded-md border p-3", isActive && "border-primary/60 bg-primary/5")}>
          <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-sm font-medium">
              <span className="truncate">{saved.name}</span>
              {isActive && (
                <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  aktif
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDuration(saved.duration)} · tersimpan di device ini
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!isActive && (
              <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => update({ soundType: "custom" })}>
                Gunakan
              </Button>
            )}
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={playSaved} aria-label="Putar ringtone">
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button" variant="outline" size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={removeSaved} aria-label="Hapus ringtone"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef} type="file" accept="audio/*" className="hidden"
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />
        <Button
          type="button" variant="outline" size="sm" disabled={disabled || recording}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" /> Upload Audio
        </Button>
        {recording ? (
          <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            <Square className="h-3 w-3" /> Stop ({formatDuration(elapsed)}/{formatDuration(MAX_SECONDS)})
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={startRecording}>
            <Mic className="h-3.5 w-3.5" /> Rekam Suara
          </Button>
        )}
      </div>
    </FileDropArea>
  );
}
