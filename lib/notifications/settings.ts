"use client";

import { useEffect, useState } from "react";
import { SOUND_PRESETS, type SoundPresetId } from "./sound";

export type NotifSettings = {
  /** Master: kalau false, tidak ada sound/browser/toast saat notif masuk. */
  enabled: boolean;
  sound: boolean;
  /** 0..1 */
  volume: number;
  soundType: SoundPresetId;
  /** Notifikasi OS saat tab tidak fokus. */
  browser: boolean;
};

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  enabled: true,
  sound: true,
  volume: 0.6,
  soundType: "tritone",
  browser: true,
};

const STORAGE_KEY = "designdesk-notif-settings";
const CHANGE_EVENT = "designdesk-notif-settings-changed";

export function loadNotifSettings(): NotifSettings {
  if (typeof window === "undefined") return DEFAULT_NOTIF_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIF_SETTINGS;
    const parsed = { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) } as NotifSettings;
    const validSound = parsed.soundType === "custom" || SOUND_PRESETS.some((p) => p.id === parsed.soundType);
    return validSound ? parsed : { ...parsed, soundType: DEFAULT_NOTIF_SETTINGS.soundType };
  } catch {
    return DEFAULT_NOTIF_SETTINGS;
  }
}

export function saveNotifSettings(settings: NotifSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: settings }));
  } catch {}
}

/** Tersinkron antar komponen (custom event) dan antar tab (storage event). */
export function useNotifSettings() {
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS);

  useEffect(() => {
    setSettings(loadNotifSettings());
    const onChange = () => setSettings(loadNotifSettings());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (patch: Partial<NotifSettings>) => {
    const next = { ...loadNotifSettings(), ...patch };
    saveNotifSettings(next);
    setSettings(next);
  };

  return { settings, update };
}
