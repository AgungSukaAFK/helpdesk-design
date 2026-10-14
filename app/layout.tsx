import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { getSiteUrl } from "@/lib/site-url";
import { fontVariables } from "@/lib/fonts";
import { appearanceInitScript } from "@/lib/appearance-init";
import { CustomThemeProvider } from "@/lib/theme-provider";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#090b0a",
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "DesignDesk — Helpdesk & Manajemen Desain",
  description: "Aplikasi Helpdesk & Manajemen Desain Terpadu",
  applicationName: "DesignDesk",
  appleWebApp: {
    capable: true,
    title: "DesignDesk",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Terapkan aksen, font, ukuran font & radius tersimpan sebelum render (anti-flash) */}
        <script dangerouslySetInnerHTML={{ __html: appearanceInitScript }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <CustomThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={["light", "dark", "soft-light", "soft-dark"]}
          disableTransitionOnChange
        >
          <NotificationProvider>{children}</NotificationProvider>
        </CustomThemeProvider>
        <Toaster richColors position="bottom-right" />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
