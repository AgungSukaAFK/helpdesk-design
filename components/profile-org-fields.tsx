"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEPARTEMEN_LAINNYA,
  DEPARTEMEN_OPTIONS,
  LOKASI_OPTIONS,
  PERUSAHAAN_LOURDES,
  PERUSAHAAN_OPTIONS,
  type ProfilOrganisasi,
} from "@/lib/profile-options";
import { useState } from "react";

/**
 * Field Perusahaan, Lokasi, Departemen. Dipakai bersama oleh My Profile dan
 * User Management (tambah & edit) supaya pilihannya identik.
 */
export function ProfileOrgFields({
  value,
  onChange,
  disabled,
  idPrefix = "profil",
  triggerClassName,
}: {
  value: ProfilOrganisasi;
  onChange: (next: ProfilOrganisasi) => void;
  disabled?: boolean;
  idPrefix?: string;
  triggerClassName?: string;
}) {
  const deptDiDaftar = (DEPARTEMEN_OPTIONS as readonly string[]).includes(value.departemen);
  // Departemen di luar daftar (data lama/isian manual) tampil sebagai "Lainnya".
  const [modeLainnya, setModeLainnya] = useState(() => Boolean(value.departemen) && !deptDiDaftar);
  const lainnya = modeLainnya || (Boolean(value.departemen) && !deptDiDaftar);
  const selectDept = lainnya ? DEPARTEMEN_LAINNYA : value.departemen;

  // Nilai lama yang tidak ada di daftar tetap ditampilkan agar tidak hilang diam-diam.
  const opsiPerusahaan = value.perusahaan && !(PERUSAHAAN_OPTIONS as readonly string[]).includes(value.perusahaan)
    ? [...PERUSAHAAN_OPTIONS, value.perusahaan]
    : PERUSAHAAN_OPTIONS;
  const opsiLokasi = value.lokasi && !(LOKASI_OPTIONS as readonly string[]).includes(value.lokasi)
    ? [...LOKASI_OPTIONS, value.lokasi]
    : LOKASI_OPTIONS;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-perusahaan`}>Perusahaan</Label>
        <Select
          value={value.perusahaan}
          onValueChange={(perusahaan) => onChange({ ...value, perusahaan })}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-perusahaan`} className={triggerClassName}>
            <SelectValue placeholder="Pilih Perusahaan" />
          </SelectTrigger>
          <SelectContent>
            {opsiPerusahaan.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.perusahaan === PERUSAHAAN_LOURDES && (
          <p className="text-xs text-muted-foreground">
            Corporate: dapat mengakses data GMI dan GIS sekaligus.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-lokasi`}>Lokasi</Label>
        <Select
          value={value.lokasi}
          onValueChange={(lokasi) => onChange({ ...value, lokasi })}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-lokasi`} className={triggerClassName}>
            <SelectValue placeholder="Pilih Lokasi" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {opsiLokasi.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-departemen`}>Departemen</Label>
        <Select
          value={selectDept}
          onValueChange={(dept) => {
            if (dept === DEPARTEMEN_LAINNYA) {
              setModeLainnya(true);
              onChange({ ...value, departemen: deptDiDaftar ? "" : value.departemen });
            } else {
              setModeLainnya(false);
              onChange({ ...value, departemen: dept });
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-departemen`} className={triggerClassName}>
            <SelectValue placeholder="Pilih Departemen" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {DEPARTEMEN_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
            <SelectItem value={DEPARTEMEN_LAINNYA}>Lainnya...</SelectItem>
          </SelectContent>
        </Select>
        {lainnya && (
          <Input
            placeholder="Ketikkan nama departemen..."
            value={value.departemen}
            onChange={(e) => onChange({ ...value, departemen: e.target.value })}
            disabled={disabled}
            className={triggerClassName}
          />
        )}
      </div>
    </>
  );
}
