import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { RiwayatAdminClientContent } from "./ClientComponent";

// Komponen untuk fallback loading (skeleton)
function RiwayatSkeleton() {
  return (
    <Content title="Riwayat Pengajuan Desain" size="lg">
      <div className="flex justify-center mb-6">
        <Skeleton className="h-10 w-full md:w-2/3 lg:w-1/2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-md p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-2 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </Content>
  );
}

// Halaman utama sekarang menjadi Server Component
export default function RiwayatPage() {
  return (
    <Suspense fallback={<RiwayatSkeleton />}>
      <RiwayatAdminClientContent />
    </Suspense>
  );
}
