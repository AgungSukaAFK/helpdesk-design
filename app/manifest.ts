import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DesignDesk — Helpdesk & Manajemen Desain",
    short_name: "DesignDesk",
    description: "Aplikasi Helpdesk & Manajemen Desain Terpadu",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#090b0a",
    theme_color: "#090b0a",
    icons: [
      { src: "/lourdes.png", sizes: "any", type: "image/png" },
    ],
  };
}