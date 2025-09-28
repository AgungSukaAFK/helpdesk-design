"use client";

import { Combobox, ComboboxData } from "@/components/combobox";
import { Content } from "@/components/content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export interface PermintaanDesain {
  id: string;
  created_at: Date;
  due_date: Date;
  judul: string;
  deskripsi: string;
  status: string;
  departemen: string;
  rating: string;
  review: string;
  requester: string;
  admin: string;
  files: File[];
}

interface File {
  url: string;
  name: string;
}

const dataDepartment: ComboboxData = [
  { label: "General Affair", value: "General Affair" },
  { label: "Marketing", value: "Marketing" },
  { label: "Manufacture", value: "Manufacture" },
  { label: "K3", value: "K3" },
  { label: "Finance", value: "Finance" },
  { label: "IT", value: "IT" },
  { label: "Logistik", value: "Logistik" },
  { label: "Purchasing", value: "Purchasing" },
  { label: "Warehouse", value: "Warehouse" },
  { label: "Service", value: "Service" },
  { label: "General Manager", value: "General Manager" },
  { label: "Executive Manager", value: "Executive Manager" },
  { label: "Boards of Director", value: "Boards of Director" },
];

export default function BuatPermintaanDesainPage() {
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [alertMessage, setAlertMessage] = useState<string>("");

  const s = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const judul = formData.get("judul") as string;
    const deskripsi = formData.get("deskripsi") as string;
    const due_date = formData.get("due_date") as string;
    const departemen = selectedDepartment;

    if (!departemen) {
      setAlertMessage("Departemen harus dipilih.");
      return;
    }

    if (!judul || !deskripsi || !due_date) {
      setAlertMessage("Semua field harus diisi.");
      return;
    }

    setAlertMessage("");
    try {
      setLoading(true);
      const { data: user } = await s.auth.getUser();
      if (!user.user) {
        toast.error("Anda harus login untuk membuat permintaan desain.");
        return;
      }
      const data: Omit<PermintaanDesain, "id" | "created_at" | "admin"> = {
        departemen,
        deskripsi,
        judul,
        due_date: new Date(due_date),
        files: [],
        rating: "",
        review: "",
        status: "TO DO",
        requester: user.user.id,
      };

      const { error: insertError } = await s.from("permintaan").insert([data]);
      if (insertError) {
        throw insertError;
      }

      form.reset();
      setSelectedDepartment("");
      toast.success("Permintaan desain berhasil dibuat.");
      setAlertMessage("Berhasil membuat permintaan desain.");
    } catch (error) {
      console.log(error);

      toast.error("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function handleDepartmentChange(value: string) {
    setSelectedDepartment(value);
  }

  return (
    <>
      <Content title="Permintaan Desain" size="sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="judul">Judul Permintaan</Label>
            <Input
              type="text"
              id="judul"
              name="judul"
              required
              disabled={loading}
              placeholder="Masukkan judul permintaan desain..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="deskripsi">Deskripsi</Label>
            <Textarea
              rows={4}
              id="deskripsi"
              name="deskripsi"
              required
              disabled={loading}
              placeholder="Masukkan deskripsi permintaan desain..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="departemen">Departemen</Label>
            <Combobox
              data={dataDepartment}
              onChange={handleDepartmentChange}
              defaultValue={selectedDepartment}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              defaultValue={new Date().toISOString().split("T")[0]}
              id="due_date"
              name="due_date"
              required
              disabled={loading}
            />
          </div>
          {alertMessage && (
            <Alert>
              <AlertDescription>{alertMessage}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Submit"}
          </Button>
        </form>
      </Content>
    </>
  );
}
