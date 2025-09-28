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
import { Loader2, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

// Definisikan tipe data untuk konsistensi
interface Permintaan {
  id: string;
  judul: string;
  status: "PROGRESS" | "REVISION" | "REVIEW" | "DONE";
  due_date: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 10;

export function PermintaanClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [permintaanList, setPermintaanList] = useState<Permintaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<number>(0);

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";

  // State untuk input debounce
  const [searchInput, setSearchInput] = useState(searchTerm);

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [name, value] of Object.entries(paramsToUpdate)) {
        if (value) {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      }
      if (
        paramsToUpdate.search !== undefined ||
        paramsToUpdate.status !== undefined
      ) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  useEffect(() => {
    async function fetchPermintaan() {
      setLoading(true);
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        toast.error("Anda harus login untuk melihat permintaan.");
        setLoading(false);
        return;
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = s
        .from("permintaan")
        .select(`*`, { count: "exact" })
        .eq("requester", user.id);

      if (searchTerm) {
        query = query.ilike("judul", `%${searchTerm}%`);
      }
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data permintaan: " + error.message);
        setPermintaanList([]);
      } else {
        setPermintaanList(data || []);
        setTotalItems(count || 0);
      }
      setLoading(false);
    }

    fetchPermintaan();
  }, [s, currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    const handler = setTimeout(() => {
      router.push(pathname + "?" + createQueryString({ search: searchInput }));
    }, 500);

    return () => clearTimeout(handler);
  }, [searchInput, pathname, router, createQueryString]);

  const handleStatusFilterChange = (value: string) => {
    router.push(
      pathname +
        "?" +
        createQueryString({ status: value === "all" ? "" : value })
    );
  };

  const getStatusVariant = (status: Permintaan["status"]) => {
    switch (status) {
      case "DONE":
        return "default";
      case "PROGRESS":
        return "secondary";
      case "REVISION":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <Content
      title="Daftar Permintaan Saya"
      size="lg"
      cardAction={
        <Button asChild>
          <Link href="/permintaan-desain/buat">Buat Permintaan Baru</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan judul..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            onValueChange={handleStatusFilterChange}
            defaultValue={statusFilter || "all"}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter status" />
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
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
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
                    <TableCell>
                      <Badge variant={getStatusVariant(permintaan.status)}>
                        {permintaan.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(permintaan.due_date).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/permintaan-desain/${permintaan.id}`}>
                          Lihat Detail
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Tidak ada permintaan yang ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationComponent
          basePath={`${pathname}?${createQueryString({ page: "" }).slice(
            0,
            -1
          )}`}
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>
    </Content>
  );
}
