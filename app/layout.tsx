import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "sonner";
import { getSiteUrl } from "@/lib/site-url";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "DesignDesk — Helpdesk & Manajemen Desain",
  description: "Aplikasi Helpdesk & Manajemen Desain Terpadu",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

import { AccentThemeProvider } from "@/components/accent-theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var accent = localStorage.getItem('theme-accent');
                var radius = localStorage.getItem('theme-radius') || '0.625rem';
                var presets = {
                  forest: { lp: '144 59% 22%', lr: '144 59% 28%', la: '144 35% 93%', laf: '144 59% 18%', lsp: 'hsl(144 59% 22%)', dp: '144 50% 46%', dr: '144 50% 50%', da: '144 30% 16%', daf: '144 50% 90%', dsp: 'hsl(144 50% 46%)' },
                  emerald: { lp: '173 80% 30%', lr: '173 80% 36%', la: '173 60% 94%', laf: '173 80% 22%', lsp: 'hsl(173 80% 30%)', dp: '173 70% 44%', dr: '173 70% 50%', da: '173 35% 16%', daf: '173 70% 90%', dsp: 'hsl(173 70% 44%)' },
                  blue: { lp: '217 91% 48%', lr: '217 91% 54%', la: '217 80% 94%', laf: '217 91% 30%', lsp: 'hsl(217 91% 48%)', dp: '217 91% 60%', dr: '217 91% 65%', da: '217 40% 16%', daf: '217 91% 90%', dsp: 'hsl(217 91% 60%)' },
                  violet: { lp: '263 70% 50%', lr: '263 70% 56%', la: '263 70% 95%', laf: '263 70% 30%', lsp: 'hsl(263 70% 50%)', dp: '263 75% 65%', dr: '263 75% 70%', da: '263 35% 16%', daf: '263 75% 90%', dsp: 'hsl(263 75% 65%)' },
                  amber: { lp: '38 92% 44%', lr: '38 92% 50%', la: '38 90% 93%', laf: '38 92% 25%', lsp: 'hsl(38 92% 44%)', dp: '38 92% 50%', dr: '38 92% 55%', da: '38 40% 16%', daf: '38 92% 90%', dsp: 'hsl(38 92% 50%)' },
                  rose: { lp: '346 84% 50%', lr: '346 84% 55%', la: '346 80% 95%', laf: '346 84% 30%', lsp: 'hsl(346 84% 50%)', dp: '346 84% 60%', dr: '346 84% 65%', da: '346 35% 16%', daf: '346 84% 90%', dsp: 'hsl(346 84% 60%)' },
                  slate: { lp: '222.2 47.4% 25%', lr: '222.2 47.4% 35%', la: '215 20% 92%', laf: '222.2 47.4% 15%', lsp: 'hsl(222.2 47.4% 25%)', dp: '215 20% 85%', dr: '215 20% 70%', da: '217.2 32.6% 17.5%', daf: '210 40% 98%', dsp: 'hsl(215 20% 85%)' }
                };
                var radMap = { sm: '0.375rem', default: '0.625rem', lg: '0.875rem' };
                var radVal = radMap[radius] || radius;
                var p = presets[accent] || presets.emerald;
                var s = document.createElement('style');
                s.id = 'theme-accent-styles';
                s.innerHTML = ':root{--primary:'+p.lp+';--ring:'+p.lr+';--accent:'+p.la+';--accent-foreground:'+p.laf+';--sidebar-primary:'+p.lsp+';--radius:'+radVal+';}.dark{--primary:'+p.dp+';--ring:'+p.dr+';--accent:'+p.da+';--accent-foreground:'+p.daf+';--sidebar-primary:'+p.dsp+';--radius:'+radVal+';}';
                document.head.appendChild(s);
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className={`${geistSans.className} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AccentThemeProvider>{children}</AccentThemeProvider>
        </ThemeProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
