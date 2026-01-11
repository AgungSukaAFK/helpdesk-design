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
import { Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useState,
  useCallback,
  useTransition,
  Suspense,
} from "react";
import { toast } from "sonner";

// Definisi Tipe Data
interface Permintaan {
  id: string;
  judul: string;
  project: string;
  status: "PROGRESS" | "REVISION" | "REVIEW" | "DONE";
  due_date: string;
  created_at: string;
  admin?: string | null; // ID Desainer
  admin_name?: string; // Nama Desainer (hasil mapping)
}

const ITEMS_PER_PAGE = 10;

function PermintaanList() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [permintaanList, setPermintaanList] = useState<Permintaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // State URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";

  // State Input (Debounce)
  const [searchInput, setSearchInput] = useState(searchTerm);

  // 1. Cek User Login
  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    getUser();
  }, [s]);

  // 2. Helper Update URL
  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value) params.set(name, String(value));
        else params.delete(name);
      });
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  // 3. Debounce Search
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
      if (!userId) return; // Tunggu user terload
      setLoading(true);

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Query ke tabel 'permintaan'
      let query = s
        .from("permintaan")
        .select("*", { count: "exact" })
        .eq("requester", userId); // Filter hanya milik user ini

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

      // --- LOGIKA MAPPING NAMA DESAINER (FIX BUG LOADING) ---

      // Kumpulkan ID admin (desainer) yang tidak null
      const adminIds = formattedData
        .map((d) => d.admin)
        .filter((id): id is string => Boolean(id));

      // Jika ada admin yang assigned, kita fetch namanya
      if (adminIds.length > 0) {
        // PERHATIAN: Pastikan nama tabel referensi user Anda benar ('users' atau 'user_profiles')
        // Berdasarkan schema yang Anda kirim sebelumnya, tabelnya adalah 'users'.
        const { data: adminData } = await s
          .from("users")
          .select("id, name")
          .in("id", adminIds);

        const adminMap: Record<string, string> = {};
        adminData?.forEach((user) => {
          if (user.id) adminMap[user.id] = user.name || "Unknown";
        });

        // Pasangkan nama ke data permintaan
        formattedData = formattedData.map((item) => ({
          ...item,
          admin_name: item.admin ? adminMap[item.admin] : "-",
        }));
      }

      // Update State
      setPermintaanList(formattedData);
      setTotalItems(count || 0);
      setLoading(false); // <--- Loading dimatikan di sini, apapun yang terjadi
    }

    fetchPermintaan();
  }, [s, userId, currentPage, searchTerm, statusFilter]);

  // Helper Variant Badge
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

  const handleStatusFilter = (val: string) => {
    startTransition(() => {
      router.push(
        pathname +
          "?" +
          createQueryString({ status: val === "all" ? undefined : val })
      );
    });
  };

  return (
    <Content
      title="Daftar Permintaan Saya"
      size="lg"
      cardAction={
        <Button asChild>
          <Link href="/permintaan-desain/buat">
            <Plus className="mr-2 h-4 w-4" /> Buat Permintaan Baru
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan judul..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter || "all"}
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger className="w-full md:w-[200px]">
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
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Desainer</TableHead>
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
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : permintaanList.length > 0 ? (
              permintaanList.map((permintaan, index) => (
                <TableRow key={permintaan.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {permintaan.judul}
                  </TableCell>
                  <TableCell>{permintaan.project}</TableCell>
                  <TableCell>
                    {/* Tampilkan nama desainer atau 'Belum ada' */}
                    {permintaan.admin_name ||
                      (permintaan.admin ? "Memuat..." : "Belum ditentukan")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(permintaan.status) as any}>
                      {permintaan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(permintaan.due_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/permintaan-desain/${permintaan.id}`}>
                        Lihat Detail
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-24 text-muted-foreground"
                >
                  Tidak ada permintaan yang ditemukan.
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
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>
    </Content>
  );
}

// Wrapper Suspense Wajib untuk App Router agar tidak error useSearchParams
export default function PermintaanClientContent() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64 w-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PermintaanList />
    </Suspense>
  );
}
