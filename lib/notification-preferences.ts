export type NotificationSound = "ding-dong" | "soft-chime" | "double-pulse";

export interface NotificationPreferences {
  realtime: boolean;
  sound: boolean;
  volume: number;
  soundPreset: NotificationSound;
  customAudioName: string | null;
  customAudioDataUrl: string | null;
  browser: boolean;
  device: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  realtime: true,
  sound: true,
  volume: 70,
  soundPreset: "ding-dong",
  customAudioName: null,
  customAudioDataUrl: null,
  browser: false,
  device: false,
};

const STORAGE_PREFIX = "designdesk-notification-preferences-v1";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function readNotificationPreferences(userId: string): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const stored = localStorage.getItem(storageKey(userId));
    if (!stored) return DEFAULT_NOTIFICATION_PREFERENCES;
    const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsed,
      volume: Math.min(100, Math.max(0, Number(parsed.volume ?? DEFAULT_NOTIFICATION_PREFERENCES.volume))),
      soundPreset: ["ding-dong", "soft-chime", "double-pulse"].includes(String(parsed.soundPreset))
        ? parsed.soundPreset as NotificationSound
        : DEFAULT_NOTIFICATION_PREFERENCES.soundPreset,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function writeNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences
) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}