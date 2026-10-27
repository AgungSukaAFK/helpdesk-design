"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ALL_NAV_ITEMS } from "@/lib/sidebar/nav-config";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

/** Label segmen "buat" & UUID di akhir URL, per halaman induk. */
const CREATE_LABELS: Record<string, string> = {
  "/permintaan-desain": "Buat Permintaan",
  "/permintaan-desain-admin": "Buat Permintaan",
  "/artikel-admin": "Tulis Artikel",
};
const DETAIL_LABELS: Record<string, string> = {
  "/artikel-admin": "Edit Artikel",
  "/user-management": "Detail User",
};

function toTitle(part: string) {
  return decodeURIComponent(part.replace(/-/g, " ").replace(/\b\w/g, (s) => s.toUpperCase()));
}

function buildCrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string }[] = [];

  parts.forEach((part, index) => {
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    const parent = `/${parts.slice(0, index).join("/")}`;
    const isLast = index === parts.length - 1;

    if (UUID_RE.test(part)) {
      // UUID di tengah URL tidak ditampilkan; di akhir diganti label halaman.
      if (isLast) crumbs.push({ href, label: DETAIL_LABELS[parent] ?? "Detail" });
      return;
    }

    const navItem = ALL_NAV_ITEMS.find((i) => i.url === href);
    let label = navItem?.title ?? toTitle(part);
    if (part === "buat") label = CREATE_LABELS[parent] ?? "Buat";
    else if (part === "edit") label = "Edit";
    crumbs.push({ href, label });
  });

  return crumbs;
}

export function TopbarBreadcrumb() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap gap-1 text-sm sm:gap-1.5">
        <BreadcrumbItem className="hidden md:inline-flex">
          <BreadcrumbLink asChild className="whitespace-nowrap">
            <Link href="/dashboard">Design Desk</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              {/* Mobile: hanya crumb terakhir */}
              <BreadcrumbSeparator className="hidden md:inline-flex" />
              <BreadcrumbItem className={isLast ? "min-w-0" : "hidden md:inline-flex"}>
                {isLast ? (
                  <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="whitespace-nowrap">
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
