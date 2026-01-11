"use client";

import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Search, Newspaper, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// Tipe Data Gabungan
interface Permintaan {
  id: string;
  judul: string;
  admin: string | null; // ID Admin (untuk view User)
  admin_name?: string; // Nama Admin (hasil mapping)
  project: string;
  status: "PROGRESS" | "REVISION" | "REVIEW" | "DONE";
  due_date: string;
  created_at: string;
  deskripsi?: string;
  departemen?: string;
  requester?: {
    name: string;
  } | null; // Relasi Requester (untuk view Admin)
}

const ITEMS_PER_PAGE = 10;
const LIMIT_OPTIONS = [10, 25, 50, 100];

export default function PermintaanClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State Global
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [permintaanList, setPermintaanList] = useState<Permintaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  // State URL / Filter
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  // Admin bisa ubah limit, User default 10
  const limit = isAdmin
    ? Number(searchParams.get("limit") || 10)
    : ITEMS_PER_PAGE;

  // State Input Lokal (Debounce)
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);

  // 1. Cek User & Role saat pertama load
  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        toast.error("Silakan login terlebih dahulu.");
        return;
      }
      setUserId(user.id);

      // Cek apakah user ini admin (cek tabel user_profiles atau role)
      // Asumsi: Kita cek role dari tabel user_profiles
      const { data: profile } = await s
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "admin") {
        setIsAdmin(true);
      }
    }
    checkUser();
  }, [s]);

  // 2. Helper Query String
  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value) {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      });
      // Reset ke page 1 jika filter berubah (bukan paging)
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  // 3. Update URL saat search input berubah (Debounce)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(
            pathname + "?" + createQueryString({ search: searchInput })
          );
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  // 4. Fetch Data Utama
  useEffect(() => {
    async function fetchPermintaan() {
      if (!userId) return; // Tunggu user teridentifikasi
      setLoading(true);

      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      // Select query: Ambil juga relasi requester (berguna utk admin)
      let query = s
        .from("permintaan")
        .select(`*, requester:user_profiles(name)`, { count: "exact" });

      // FILTER LOGIC
      if (!isAdmin) {
        // User Biasa: Hanya lihat milik sendiri
        query = query.eq("requester", userId);
      } else {
        // Admin: Filter tanggal (opsional)
        if (startDate) query = query.gte("created_at", startDate);
        if (endDate) query = query.lte("created_at", `${endDate} 23:59:59`);
      }

      // Filter Umum
      if (searchTerm) query = query.ilike("judul", `%${searchTerm}%`);
      if (statusFilter) query = query.eq("status", statusFilter);

      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data: " + error.message);
        setPermintaanList([]);
        setLoading(false);
        return;
      }

      let formattedData = (data as Permintaan[]) || [];

      // KHUSUS USER VIEW: Mapping nama Admin/Desainer
      // Karena kolom 'admin' isinya UUID, kita perlu fetch nama desainer
      if (!isAdmin && formattedData.length > 0) {
        const adminIds = formattedData
          .map((d) => d.admin)
          .filter((id): id is string => Boolean(id));

        if (adminIds.length > 0) {
          const { data: adminProfiles } = await s
            .from("user_profiles")
            .select("id, name")
            .in("id", adminIds);

          const adminMap: Record<string, string> = {};
          adminProfiles?.forEach((p) => {
            if (p.id) adminMap[p.id] = p.name || "Unknown";
          });

          formattedData = formattedData.map((item) => ({
            ...item,
            admin_name: item.admin ? adminMap[item.admin] : "-",
          }));
        }
      }

      setPermintaanList(formattedData);
      setTotalItems(count || 0);
      setLoading(false); // FIXED: Loading mati di sini apapun kondisinya
    }

    fetchPermintaan();
  }, [
    s,
    userId,
    isAdmin,
    currentPage,
    searchTerm,
    statusFilter,
    startDate,
    endDate,
    limit,
  ]);

  // 5. Fungsi Export Excel (Hanya Admin)
  const handleDownloadExcel = async () => {
    setIsExporting(true);
    toast.info("Mempersiapkan data...");

    try {
      let query = s.from("permintaan").select(`
        created_at, due_date, judul, deskripsi, status, departemen, project,
        requester:user_profiles (name)
      `);

      // Terapkan filter yang sedang aktif
      if (searchTerm) query = query.ilike("judul", `%${searchTerm}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate} 23:59:59`);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning("Tidak ada data untuk diekspor.");
        return;
      }

      // @ts-ignore
      const formatted = data.map((item) => ({
        Tanggal: new Date(item.created_at).toLocaleString("id-ID"),
        "Due Date": new Date(item.due_date).toLocaleDateString("id-ID"),
        Judul: item.judul,
        Deskripsi: item.deskripsi,
        Status: item.status,
        Departemen: item.departemen,
        Project: item.project,
        // @ts-ignore
        Requester: item.requester?.name || "N/A",
      }));

      const ws = XLSX.utils.json_to_sheet(formatted);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Permintaan");
      XLSX.writeFile(
        wb,
        `Export_Permintaan_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.success("Download berhasil!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleStatusFilter = (val: string) => {
    startTransition(() => {
      router.push(
        pathname +
          "?" +
          createQueryString({ status: val === "all" ? undefined : val })
      );
    });
  };

  const handleFilterDate = () => {
    startTransition(() => {
      router.push(
        pathname +
          "?" +
          createQueryString({
            startDate: startDateInput,
            endDate: endDateInput,
          })
      );
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "DONE":
        return "default";
      case "PROGRESS":
        return "secondary";
      case "REVISION":
        return "outline";
      case "REVIEW":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Content
      title={
        isAdmin ? "Semua Permintaan Desain (Admin)" : "Daftar Permintaan Saya"
      }
      size="lg"
      cardAction={
        !isAdmin ? (
          <Button asChild>
            <Link href="/permintaan-desain/buat">
              <Plus className="mr-2 h-4 w-4" /> Buat Baru
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4 mb-6">
        {/* Baris Atas: Search & Action Button */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={
                isAdmin ? "Cari judul..." : "Cari permintaan saya..."
              }
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {/* Dropdown Status */}
          <Select
            value={statusFilter || "all"}
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="PROGRESS">Progress</SelectItem>
              <SelectItem value="REVISION">Revision</SelectItem>
              <SelectItem value="REVIEW">Review</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>

          {/* Tombol Export (Admin Only) */}
          {isAdmin && (
            <Button
              onClick={handleDownloadExcel}
              disabled={isExporting}
              variant="outline"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Newspaper className="mr-2 h-4 w-4" />
              )}
              Excel
            </Button>
          )}
        </div>

        {/* Panel Filter Tanggal (Admin Only) */}
        {isAdmin && (
          <div className="p-4 border rounded-lg bg-muted/30 grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <div className="space-y-2">
              <label className="text-xs font-medium">Dari Tanggal</label>
              <Input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Sampai Tanggal</label>
              <Input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
            </div>
            <Button onClick={handleFilterDate} variant="secondary">
              Terapkan
            </Button>
          </div>
        )}
      </div>

      {/* Tabel Data */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead className="hidden md:table-cell">Project</TableHead>
              {/* Kolom Dinamis: Admin lihat Requester, User lihat Desainer */}
              <TableHead>{isAdmin ? "Requester" : "Desainer"}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : permintaanList.length > 0 ? (
              permintaanList.map((item, i) => (
                <TableRow key={item.id}>
                  <TableCell>{(currentPage - 1) * limit + i + 1}</TableCell>
                  <TableCell className="font-medium">{item.judul}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item.project}
                  </TableCell>

                  {/* Isi Kolom Dinamis */}
                  <TableCell>
                    {isAdmin
                      ? item.requester?.name || "Unknown"
                      : item.admin_name || "Belum ada"}
                  </TableCell>

                  <TableCell>
                    <Badge variant={getStatusVariant(item.status) as any}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(item.due_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      {/* Arahkan link sesuai role jika perlu, atau gunakan satu route dinamis */}
                      <Link
                        href={
                          isAdmin
                            ? `/permintaan-desain-admin/${item.id}`
                            : `/permintaan-desain/${item.id}`
                        }
                      >
                        Detail
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-32 text-muted-foreground"
                >
                  Tidak ada data ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4">
        <PaginationComponent
          basePath={pathname}
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={limit}
        />
      </div>
    </Content>
  );
}
