import type { NotificationPreferences, NotificationSound } from "@/lib/notification-preferences";

interface Harmonic {
  ratio: number;
  gain: number;
  decay: number;
}

interface Note {
  frequency: number;
  offset: number;
  duration: number;
  type?: OscillatorType;
  attack?: number;
  gain?: number;
  harmonics: Harmonic[];
}

const BELL_HARMONICS: Harmonic[] = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2.01, gain: 0.34, decay: 0.72 },
  { ratio: 3.02, gain: 0.15, decay: 0.48 },
  { ratio: 4.98, gain: 0.06, decay: 0.3 },
];

const CHIME_HARMONICS: Harmonic[] = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2, gain: 0.24, decay: 0.7 },
  { ratio: 3.01, gain: 0.09, decay: 0.46 },
];

const PULSE_HARMONICS: Harmonic[] = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2, gain: 0.26, decay: 0.58 },
  { ratio: 3, gain: 0.09, decay: 0.36 },
];

const MALLET_HARMONICS: Harmonic[] = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 3.99, gain: 0.28, decay: 0.26 },
  { ratio: 9.2, gain: 0.07, decay: 0.12 },
];

const SPARKLE_HARMONICS: Harmonic[] = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2, gain: 0.48, decay: 0.54 },
  { ratio: 3.01, gain: 0.26, decay: 0.36 },
  { ratio: 4.51, gain: 0.11, decay: 0.22 },
];

const SOUND_PRESETS: Record<NotificationSound, Note[]> = {
  "ding-dong": [
    { frequency: 698.46, offset: 0, duration: 0.5, attack: 0.006, gain: 0.82, harmonics: BELL_HARMONICS },
    { frequency: 1046.5, offset: 0.17, duration: 0.78, attack: 0.006, gain: 1, harmonics: BELL_HARMONICS },
  ],
  "soft-chime": [
    { frequency: 659.25, offset: 0, duration: 0.44, type: "triangle", gain: 0.66, harmonics: CHIME_HARMONICS },
    { frequency: 783.99, offset: 0.13, duration: 0.5, type: "triangle", gain: 0.78, harmonics: CHIME_HARMONICS },
    { frequency: 987.77, offset: 0.26, duration: 0.74, type: "triangle", gain: 0.9, harmonics: CHIME_HARMONICS },
  ],
  "double-pulse": [
    { frequency: 880, offset: 0, duration: 0.19, attack: 0.004, gain: 0.78, harmonics: PULSE_HARMONICS },
    { frequency: 880, offset: 0.24, duration: 0.34, attack: 0.004, gain: 1, harmonics: PULSE_HARMONICS },
  ],
  marimba: [
    { frequency: 587.33, offset: 0, duration: 0.42, attack: 0.003, gain: 0.78, harmonics: MALLET_HARMONICS },
    { frequency: 880, offset: 0.15, duration: 0.64, attack: 0.003, gain: 0.9, harmonics: MALLET_HARMONICS },
  ],
  sparkle: [
    { frequency: 659.25, offset: 0, duration: 0.2, type: "triangle", attack: 0.003, gain: 0.52, harmonics: SPARKLE_HARMONICS },
    { frequency: 830.61, offset: 0.075, duration: 0.2, type: "triangle", attack: 0.003, gain: 0.62, harmonics: SPARKLE_HARMONICS },
    { frequency: 987.77, offset: 0.15, duration: 0.24, type: "triangle", attack: 0.003, gain: 0.72, harmonics: SPARKLE_HARMONICS },
    { frequency: 1318.51, offset: 0.225, duration: 0.54, type: "triangle", attack: 0.003, gain: 0.9, harmonics: SPARKLE_HARMONICS },
  ],
  pop: [
    { frequency: 659.25, offset: 0, duration: 0.11, attack: 0.002, gain: 0.68, harmonics: PULSE_HARMONICS },
    { frequency: 987.77, offset: 0.1, duration: 0.34, attack: 0.002, gain: 1, harmonics: PULSE_HARMONICS },
  ],
};

const MAX_GAIN = 0.24;
const SILENCE_FLOOR = 0.0001;

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Constructor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Constructor) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new Constructor();
  }
  return sharedContext;
}

function scheduleNote(
  context: AudioContext,
  destination: AudioNode,
  note: Note,
  startAt: number,
  volume: number
) {
  const attack = note.attack ?? 0.01;
  const peak = volume * (note.gain ?? 1);

  for (const harmonic of note.harmonics) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const decay = note.duration * harmonic.decay;
    const harmonicAttack = Math.max(0.004, attack / (1 + (harmonic.ratio - 1) * 0.35));

    oscillator.type = note.type ?? "sine";
    oscillator.frequency.setValueAtTime(note.frequency * harmonic.ratio, startAt);

    gain.gain.setValueAtTime(SILENCE_FLOOR, startAt);
    gain.gain.linearRampToValueAtTime(Math.max(SILENCE_FLOOR, peak * harmonic.gain), startAt + harmonicAttack);
    gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, startAt + decay);

    oscillator.connect(gain).connect(destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + decay + 0.05);
  }
}

export function playNotificationAudio(preferences: NotificationPreferences): Promise<void> {
  if (!preferences.sound || preferences.volume <= 0) return Promise.resolve();

  if (preferences.customAudioDataUrl) {
    const audio = new Audio(preferences.customAudioDataUrl);
    audio.volume = Math.min(1, Math.max(0, preferences.volume / 100));
    return audio.play().then(() => undefined).catch(() => undefined);
  }

  const notes = SOUND_PRESETS[preferences.soundPreset];
  if (!notes?.length) return Promise.resolve();

  return (async () => {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return;
      }
    }

    const volume = Math.min(1, Math.max(0, preferences.volume / 100)) * MAX_GAIN;
    const master = context.createGain();
    master.gain.setValueAtTime(volume, context.currentTime);
    master.connect(context.destination);

    for (const note of notes) {
      scheduleNote(context, master, note, context.currentTime + note.offset, 1);
    }

    const longest = Math.max(...notes.map((note) => note.offset + note.duration));
    window.setTimeout(() => master.disconnect(), (longest + 0.2) * 1000);
  })();
}
