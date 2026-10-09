"use client";

import { getCustomSoundUrl } from "./custom-sound-db";

export const SOUND_PRESET_GROUPS = ["Lembut", "Ceria", "Tegas"] as const;
export type SoundPresetGroup = (typeof SOUND_PRESET_GROUPS)[number];

// Urutan ini dipakai tombol prev/next di pengaturan.
export const SOUND_PRESETS = [
  { id: "chime", label: "Chime", group: "Lembut" },
  { id: "crystal", label: "Crystal", group: "Lembut" },
  { id: "ding", label: "Ding", group: "Lembut" },
  { id: "softbell", label: "Soft Bell", group: "Lembut" },
  { id: "harp", label: "Harp", group: "Lembut" },
  { id: "kalimba", label: "Kalimba", group: "Lembut" },
  { id: "droplet", label: "Droplet", group: "Lembut" },
  { id: "tritone", label: "Tri-tone (premium)", group: "Ceria" },
  { id: "marimba", label: "Marimba", group: "Ceria" },
  { id: "pop", label: "Pop", group: "Ceria" },
  { id: "twinkle", label: "Twinkle", group: "Ceria" },
  { id: "success", label: "Success", group: "Ceria" },
  { id: "bubble", label: "Bubble", group: "Ceria" },
  { id: "retro", label: "Retro 8-bit", group: "Ceria" },
  { id: "whistle", label: "Whistle", group: "Ceria" },
  { id: "doorbell", label: "Doorbell", group: "Tegas" },
  { id: "piano", label: "Piano Chord", group: "Tegas" },
  { id: "alert", label: "Alert", group: "Tegas" },
  { id: "urgent", label: "Urgent", group: "Tegas" },
] as const satisfies readonly { id: string; label: string; group: SoundPresetGroup }[];

export type SoundPresetId = (typeof SOUND_PRESETS)[number]["id"] | "custom";

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

let sharedAudioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") sharedAudioCtx = new Ctor();
  return sharedAudioCtx;
}

/** Panggil dari gesture user pertama (klik/keydown). */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

function tone(ctx: AudioContext, opts: {
  freq: number; start: number; dur: number; type: OscillatorType; peak: number; glideTo?: number;
}) {
  const { freq, start, dur, type, peak, glideTo } = opts;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

/** Nada berurutan dengan jeda tetap. */
function seq(ctx: AudioContext, now: number, freqs: number[], gap: number, dur: number, type: OscillatorType, peak: number) {
  freqs.forEach((freq, i) => tone(ctx, { freq, start: now + i * gap, dur, type, peak }));
}

export function playSound(preset: SoundPresetId, volume = 0.6) {
  if (preset === "custom") {
    void playCustomSound(volume);
    return;
  }
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const v = Math.max(0, Math.min(1, volume));
    if (v === 0) return;
    const now = ctx.currentTime;
    switch (preset) {
      // --- Lembut ---
      case "chime":
        seq(ctx, now, [587.33, 880], 0.16, 0.5, "sine", 0.5 * v);
        break;
      case "crystal":
        seq(ctx, now, [1046.5, 1318.51, 1567.98], 0.09, 0.7, "sine", 0.5 * v);
        tone(ctx, { freq: 2093, start: now + 0.05, dur: 0.5, type: "sine", peak: 0.18 * v });
        break;
      case "ding":
        tone(ctx, { freq: 880, start: now, dur: 0.6, type: "sine", peak: 0.55 * v });
        tone(ctx, { freq: 1760, start: now, dur: 0.4, type: "sine", peak: 0.2 * v });
        break;
      case "softbell":
        tone(ctx, { freq: 392, start: now, dur: 1.1, type: "sine", peak: 0.5 * v });
        tone(ctx, { freq: 784, start: now, dur: 0.8, type: "sine", peak: 0.16 * v });
        tone(ctx, { freq: 1176, start: now, dur: 0.5, type: "sine", peak: 0.06 * v });
        break;
      case "harp":
        seq(ctx, now, [523.25, 587.33, 659.25, 783.99, 880], 0.055, 0.55, "sine", 0.38 * v);
        break;
      case "kalimba":
        [659.25, 987.77].forEach((f, i) => {
          const start = now + i * 0.13;
          tone(ctx, { freq: f, start, dur: 0.35, type: "triangle", peak: 0.5 * v });
          tone(ctx, { freq: f * 3, start, dur: 0.12, type: "sine", peak: 0.08 * v });
        });
        break;
      case "droplet":
        tone(ctx, { freq: 1400, glideTo: 600, start: now, dur: 0.12, type: "sine", peak: 0.55 * v });
        tone(ctx, { freq: 1800, glideTo: 850, start: now + 0.15, dur: 0.1, type: "sine", peak: 0.35 * v });
        break;
      // --- Ceria ---
      case "tritone":
        seq(ctx, now, [659.25, 783.99, 1046.5], 0.13, 0.34, "triangle", 0.6 * v);
        break;
      case "marimba":
        seq(ctx, now, [523.25, 783.99], 0.11, 0.22, "triangle", 0.6 * v);
        break;
      case "pop":
        tone(ctx, { freq: 420, glideTo: 900, start: now, dur: 0.13, type: "sine", peak: 0.6 * v });
        break;
      case "twinkle":
        seq(ctx, now, [1046.5, 1318.51, 1567.98, 2093], 0.07, 0.35, "sine", 0.4 * v);
        break;
      case "success":
        seq(ctx, now, [523.25, 659.25, 783.99], 0.09, 0.2, "triangle", 0.5 * v);
        tone(ctx, { freq: 1046.5, start: now + 0.27, dur: 0.55, type: "triangle", peak: 0.55 * v });
        break;
      case "bubble":
        [[300, 700], [400, 900], [520, 1150]].forEach(([from, to], i) =>
          tone(ctx, { freq: from, glideTo: to, start: now + i * 0.09, dur: 0.1, type: "sine", peak: 0.5 * v }));
        break;
      case "retro":
        seq(ctx, now, [523.25, 659.25, 783.99, 1046.5], 0.07, 0.09, "square", 0.22 * v);
        break;
      case "whistle":
        tone(ctx, { freq: 900, glideTo: 1500, start: now, dur: 0.15, type: "sine", peak: 0.45 * v });
        tone(ctx, { freq: 1500, glideTo: 1100, start: now + 0.17, dur: 0.2, type: "sine", peak: 0.45 * v });
        break;
      // --- Tegas ---
      case "doorbell":
        [659.25, 523.25].forEach((f, i) => {
          const start = now + i * 0.38;
          tone(ctx, { freq: f, start, dur: 0.8, type: "sine", peak: 0.55 * v });
          tone(ctx, { freq: f * 2, start, dur: 0.4, type: "sine", peak: 0.15 * v });
        });
        break;
      case "piano":
        [523.25, 659.25, 783.99].forEach((f) => {
          tone(ctx, { freq: f, start: now, dur: 0.9, type: "triangle", peak: 0.3 * v });
          tone(ctx, { freq: f * 2, start: now, dur: 0.35, type: "sine", peak: 0.06 * v });
        });
        break;
      case "alert":
        seq(ctx, now, [880, 880], 0.2, 0.13, "square", 0.25 * v);
        break;
      case "urgent":
        seq(ctx, now, [1174.66, 1174.66, 1174.66], 0.12, 0.08, "triangle", 0.55 * v);
        break;
    }
  } catch {}
}

export async function playCustomSound(volume = 0.6): Promise<boolean> {
  try {
    const url = await getCustomSoundUrl();
    if (!url) return false;
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
