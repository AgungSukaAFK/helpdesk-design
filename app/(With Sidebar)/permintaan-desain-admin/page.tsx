import { Suspense } from "react";
import { PermintaanAdminClientContent } from "./ClientComponent";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Komponen untuk fallback loading (skeleton)
function PermintaanAdminSkeleton() {
  return (
    <Content title="Daftar Semua Permintaan Desain" size="lg">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Skeleton className="h-10 w-full md:w-1/2" />
        <Skeleton className="h-10 w-full md:w-[200px]" />
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>
                <Skeleton className="h-5 w-[50px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-[100px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-[120px]" />
              </TableCell>
              <TableCell className="flex justify-end">
                <Skeleton className="h-8 w-[100px]" />
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Content>
  );
}

// Halaman utama sekarang menjadi Server Component yang membungkus Client Component
export default function PermintaanDesainAdminPage() {
  return (
    <Suspense fallback={<PermintaanAdminSkeleton />}>
      <PermintaanAdminClientContent />
    </Suspense>
  );
}
