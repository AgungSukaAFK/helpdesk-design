import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Palette, Rocket, Users } from "lucide-react";
import Image from "next/image";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function LandingPageV2() {
  return (
    // Menggunakan bg-background dan text-foreground untuk dasar theming
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      {/* Header: Menggunakan variabel border dan background */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <a href="#" className="flex items-center gap-2">
            {/* Menggunakan text-primary untuk warna aksen */}
            <Palette className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">DesignDesk</span>
          </a>
          <nav className="hidden items-center gap-6 md:flex">
            {/* Menggunakan text-muted-foreground dan hover:text-primary */}
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Fitur
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Cara Kerja
            </a>
            <a
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Testimoni
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Button variant="ghost" size="sm">
              <a href="/auth/login">Masuk</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section: Dihilangkan bg-white, karena sudah di-handle oleh bg-background */}
        <section className="relative overflow-hidden py-20 md:py-32">
          <div className="container mx-auto px-4">
            {/* Gradient Glow menggunakan warna primary */}
            <div className="absolute -top-1/4 right-0 -z-0 h-full w-2/3 rounded-full bg-primary/10 blur-[100px]" />
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <div className="max-w-xl">
                {/* Menggunakan text-foreground dan text-muted-foreground */}
                <h1 className="text-4xl font-extrabold tracking-tighter text-foreground sm:text-5xl md:text-6xl">
                  Platform Kolaborasi Desain Tanpa Batas
                </h1>
                <p className="mt-6 text-lg leading-8 text-muted-foreground">
                  Ubah cara tim Anda meminta, mereview, dan menyetujui desain.
                  DesignDesk adalah pusat komando untuk semua kebutuhan kreatif
                  Anda.
                </p>
                <div className="mt-10 flex items-center gap-4">
                  {/* Shadow juga menggunakan warna primary */}
                  <Button
                    asChild
                    size="lg"
                    className="shadow-lg shadow-primary/20"
                  >
                    <a href="/dashboard">Masuk ke Dashboard</a>
                  </Button>
                  <Button size="lg" variant="outline">
                    <a href="/auth/signup">Daftar Sekarang</a>
                  </Button>
                </div>
              </div>
              <div className="hidden lg:block">
                <Image
                  src="https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzZ8fGRlc2lnbnxlbnwwfHwwfHx8MA%3D%3D"
                  alt="Dashboard Preview"
                  width={1200}
                  height={800}
                  className="rounded-xl shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Alur Kerja Kreatif yang Lebih Baik
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Semua fitur dirancang untuk menghilangkan hambatan dan
                mempercepat proses kreatif.
              </p>
            </div>
            <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="transform transition-transform hover:-translate-y-1">
                <CardHeader>
                  {/* Latar ikon menggunakan bg-accent dan ikon menggunakan text-primary */}
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                    <Rocket className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Pengajuan Cepat</CardTitle>
                  <CardDescription>
                    Formulir cerdas yang memastikan desainer mendapatkan semua
                    informasi yang dibutuhkan sejak awal.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="transform transition-transform hover:-translate-y-1">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Kolaborasi Terpusat</CardTitle>
                  <CardDescription>
                    Berikan feedback, ajukan revisi, dan lihat riwayat versi di
                    satu tempat yang mudah diakses.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="transform transition-transform hover:-translate-y-1">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                    <Check className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Persetujuan Mudah</CardTitle>
                  <CardDescription>
                    Sistem approval satu-klik untuk mempercepat pengambilan
                    keputusan dan finalisasi proyek.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="border-t border-border py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tiga Langkah Menuju Desain Sempurna
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Proses kami sederhana, transparan, dan efisien.
              </p>
            </div>
            <div className="relative mt-16">
              {/* Garis timeline menggunakan bg-border */}
              <div
                className="absolute left-1/2 top-0 -ml-px h-full w-0.5 bg-border"
                aria-hidden="true"
              />
              <div className="grid gap-12 lg:grid-cols-2">
                {/* Step circle menggunakan warna theme */}
                <div className="flex items-start gap-6">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background font-bold text-primary">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Kirim Permintaan</h3>
                    <p className="mt-2 text-muted-foreground">
                      Jelaskan kebutuhan desain Anda melalui formulir
                      terstruktur kami. Lampirkan aset dan referensi yang
                      diperlukan.
                    </p>
                  </div>
                </div>
                <div />
                <div />
                <div className="flex items-start gap-6 lg:ml-auto lg:text-right">
                  <div>
                    <h3 className="text-xl font-semibold">
                      Review & Kolaborasi
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      Terima draf awal, berikan komentar langsung, dan pantau
                      kemajuan revisi secara real-time.
                    </p>
                  </div>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background font-bold text-primary">
                    2
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background font-bold text-primary">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Setujui & Unduh</h3>
                    <p className="mt-2 text-muted-foreground">
                      Setelah desain sesuai dengan keinginan Anda, berikan
                      persetujuan akhir dan unduh semua file dalam format yang
                      Anda butuhkan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Dipercaya oleh Tim Hebat di Seluruh Dunia
              </h2>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="italic text-muted-foreground">
                    &quot;DesignDesk mengubah alur kerja kami...&quot;
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://i.pravatar.cc/150?img=1" />
                      <AvatarFallback>AD</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">Aulia Dewi</p>
                      <p className="text-sm text-muted-foreground">
                        Marketing Manager, TechCorp
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="italic text-muted-foreground">
                    &quot;Sebagai desainer, saya sangat terbantu...&quot;
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://i.pravatar.cc/150?img=2" />
                      <AvatarFallback>BP</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">Budi Prasetyo</p>
                      <p className="text-sm text-muted-foreground">
                        Lead Designer, Creative Agency
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="italic text-muted-foreground">
                    &quot;Fitur approval-nya luar biasa...&quot;
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://i.pravatar.cc/150?img=3" />
                      <AvatarFallback>CS</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">Citra Lestari</p>
                      <p className="text-sm text-muted-foreground">
                        Project Manager, Startup
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-16 text-center shadow-xl">
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                Siap Mengubah Alur Kerja Kreatif Anda?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
                Bergabunglah dengan ratusan tim yang telah beralih ke cara kerja
                yang lebih cerdas.
              </p>
              <div className="mt-8">
                <Button asChild size="lg" variant="secondary">
                  <a href="/auth/signup">Daftar Sekarang</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 py-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} DesignDesk. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Terms
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
