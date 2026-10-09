"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, ChevronLeft, ChevronRight, Download, Loader2, Play, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CustomRingtoneSettings } from "@/components/custom-ringtone-settings";
import { useNotifications } from "@/components/providers/notification-provider";
import { cn } from "@/lib/utils";
import { useNotifSettings } from "@/lib/notifications/settings";
import {
  SOUND_PRESETS, SOUND_PRESET_GROUPS, playCustomSound, playSound, unlockAudio, type SoundPresetId,
} from "@/lib/notifications/sound";
import {
  getPushSubscriptionStatus, isPushSupported, subscribeToPush, unsubscribeFromPush,
  type PushSubscriptionStatus,
} from "@/lib/notifications/push";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";

const APP_NAME = "DesignDesk";

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-input",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className={cn(
        "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
        checked ? "translate-x-5" : "translate-x-0.5",
      )} />
    </button>
  );
}

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function NotificationSettings() {
  const { settings, update } = useNotifSettings();
  const { userId } = useNotifications();
  const { canInstall, isStandalone, isIOS, promptInstall } = useInstallPrompt();
  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus>("unsubscribed");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    getPushSubscriptionStatus().then(setPushStatus);
  }, []);

  const selectSound = (soundType: SoundPresetId) => {
    update({ soundType });
    unlockAudio();
    if (soundType === "custom") playCustomSound(settings.volume);
    else playSound(soundType, settings.volume);
  };

  const presetIndex = SOUND_PRESETS.findIndex((p) => p.id === settings.soundType);
  const stepSound = (dir: 1 | -1) => {
    const n = SOUND_PRESETS.length;
    const next = presetIndex === -1 ? (dir === 1 ? 0 : n - 1) : (presetIndex + dir + n) % n;
    selectSound(SOUND_PRESETS[next].id);
  };
  const activePreset = presetIndex === -1 ? null : SOUND_PRESETS[presetIndex];

  const handleBrowserToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!("Notification" in window)) {
        toast.error("Browser ini tidak mendukung notifikasi.");
        return;
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Izin notifikasi belum diberikan di pengaturan browser.");
        return;
      }
    }
    update({ browser: enabled });
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (!userId) return;
    setPushBusy(true);
    try {
      if (enabled) {
        await subscribeToPush(userId);
        toast.success("Notifikasi HP aktif di perangkat ini.");
      } else {
        await unsubscribeFromPush();
        toast.success("Notifikasi HP dinonaktifkan di perangkat ini.");
      }
      setPushStatus(await getPushSubscriptionStatus());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengubah notifikasi HP.");
    } finally {
      setPushBusy(false);
    }
  };

  const handleInstall = async () => {
    if (await promptInstall()) toast.success(`${APP_NAME} terpasang.`);
  };

  const soundDisabled = !settings.enabled || !settings.sound;

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Bell className="h-5 w-5" /> Pengaturan Notifikasi
      </h2>

      {/* Kartu utama */}
      <div className="space-y-4 rounded-lg border p-4">
        <Row title="Notifikasi realtime" description="Tampilkan alert (suara, browser, popup) saat ada notif baru.">
          <Toggle checked={settings.enabled} onChange={(enabled) => update({ enabled })} />
        </Row>

        <Row title="Suara notifikasi" description="Bunyikan saat notif masuk.">
          <Toggle checked={settings.sound} disabled={!settings.enabled} onChange={(sound) => update({ sound })} />
        </Row>

        <div className={cn("space-y-1.5", soundDisabled && "opacity-50")}>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="notif-volume" className="font-medium">Volume</label>
            <span className="text-xs text-muted-foreground">{Math.round(settings.volume * 100)}%</span>
          </div>
          <input
            id="notif-volume" type="range" min={0} max={100} step={5}
            value={Math.round(settings.volume * 100)}
            disabled={soundDisabled}
            onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
          />
        </div>

        <div className={cn("space-y-1.5", soundDisabled && "opacity-50")}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Pilihan suara</span>
            <span className="text-xs text-muted-foreground">
              {activePreset
                ? `${activePreset.group} · ${presetIndex + 1}/${SOUND_PRESETS.length}`
                : "Ringtone custom"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
              disabled={soundDisabled} onClick={() => stepSound(-1)} aria-label="Suara sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select
              value={settings.soundType}
              onValueChange={(value) => selectSound(value as SoundPresetId)}
              disabled={soundDisabled}
            >
              <SelectTrigger className="h-9 min-w-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOUND_PRESET_GROUPS.map((group) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {SOUND_PRESETS.filter((p) => p.group === group).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                {settings.soundType === "custom" && (
                  <SelectGroup>
                    <SelectLabel>Custom</SelectLabel>
                    <SelectItem value="custom">Ringtone custom</SelectItem>
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
              disabled={soundDisabled} onClick={() => stepSound(1)} aria-label="Suara berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button" variant="outline" size="sm" className="h-9 shrink-0"
              disabled={soundDisabled} onClick={() => selectSound(settings.soundType)}
            >
              <Play className="h-3.5 w-3.5" /> Coba
            </Button>
          </div>
        </div>

        <div className="border-t pt-3">
          <CustomRingtoneSettings disabled={!settings.enabled} />
        </div>

        <div className="border-t pt-3">
          <Row title="Notifikasi browser" description="Muncul di OS saat tab tidak sedang dibuka/fokus.">
            <Toggle checked={settings.browser} disabled={!settings.enabled} onChange={handleBrowserToggle} />
          </Row>
        </div>
      </div>

      {/* Install aplikasi (hanya jika belum standalone) */}
      {!isStandalone && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Install Aplikasi</p>
              <p className="text-xs text-muted-foreground">
                {isIOS
                  ? `Di iPhone/iPad: buka di Safari, ketuk tombol Share, lalu pilih "Add to Home Screen". Setelah itu buka ${APP_NAME} dari ikonnya agar Notifikasi HP bisa diaktifkan.`
                  : canInstall
                    ? `Pasang ${APP_NAME} ke layar utama / desktop agar lebih cepat dibuka.`
                    : `Gunakan menu browser lalu pilih "Install app" atau "Tambahkan ke layar utama".`}
              </p>
            </div>
          </div>
          {canInstall && !isIOS && (
            <Button type="button" size="sm" onClick={handleInstall}>
              <Download className="h-3.5 w-3.5" /> Install {APP_NAME}
            </Button>
          )}
        </div>
      )}

      {/* Notifikasi HP (Web Push) */}
      <div className="space-y-3 rounded-lg border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="h-4 w-4" /> Notifikasi HP
        </p>
        <Row
          title="Aktifkan di perangkat ini"
          description={
            pushStatus === "unsupported" || !isPushSupported()
              ? "Belum didukung di browser ini. Di iPhone, tambahkan dulu situs ini ke Home Screen lewat Safari (Share > Add to Home Screen), lalu buka dari ikonnya."
              : "Tetap masuk walau browser/tab sudah ditutup - beda dari notifikasi browser biasa di atas."
          }
        >
          {pushBusy ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Toggle
              checked={pushStatus === "subscribed"}
              disabled={!userId || pushStatus === "unsupported"}
              onChange={handlePushToggle}
            />
          )}
        </Row>
      </div>
    </div>
  );
}
