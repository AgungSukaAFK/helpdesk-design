import type { NotificationPreferences } from "@/lib/notification-preferences";

const SOUND_NOTES: Record<NotificationPreferences["soundPreset"], [number, number, number][]> = {
  "ding-dong": [
    [698.46, 0, 0.34],
    [1046.5, 0.16, 0.48],
  ],
  "soft-chime": [
    [659.25, 0, 0.3],
    [783.99, 0.12, 0.38],
    [987.77, 0.24, 0.5],
  ],
  "double-pulse": [
    [880, 0, 0.16],
    [880, 0.27, 0.16],
  ],
};

export async function playNotificationAudio(preferences: NotificationPreferences) {
  if (!preferences.sound || preferences.volume <= 0) return;

  if (preferences.customAudioDataUrl) {
    const audio = new Audio(preferences.customAudioDataUrl);
    audio.volume = Math.min(1, Math.max(0, preferences.volume / 100));
    await audio.play();
    return;
  }

  type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!AudioContextConstructor) return;

  const context = new AudioContextConstructor();
  if (context.state === "suspended") await context.resume();
  const volume = Math.min(1, Math.max(0, preferences.volume / 100)) * 0.24;

  for (const [frequency, offset, duration] of SOUND_NOTES[preferences.soundPreset]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime + offset;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.001, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }

  const closeAfter = Math.max(...SOUND_NOTES[preferences.soundPreset].map((note) => note[1] + note[2])) + 0.1;
  window.setTimeout(() => void context.close(), closeAfter * 1000);
}