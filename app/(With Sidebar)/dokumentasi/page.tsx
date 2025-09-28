// app/dokumentasi/page.tsx

"use client";

import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, User, ShieldCheck, HelpCircle } from "lucide-react";

export default function DokumentasiPage() {
  return (
    <>
      <Content
        size="lg"
        title="Dokumentasi & Panduan Pengguna"
        cardAction={<BookOpen />}
      >
        <div className="prose prose-stone dark:prose-invert max-w-none">
          <p>
            Selamat datang di dokumentasi resmi Aplikasi Helpdesk Desain.
            Halaman ini akan memandu Anda dalam menggunakan seluruh fitur yang
            tersedia, baik sebagai <strong>Peminta Desain</strong> maupun
            sebagai <strong>Admin/Desainer</strong>.
          </p>
        </div>
      </Content>

      <Content size="lg" title="Memahami Status Permintaan">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <Badge variant="secondary">PROGRESS</Badge>
              </CardTitle>
              <CardDescription>
                Permintaan sedang aktif dikerjakan oleh tim desainer.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <Badge variant="outline">REVISION</Badge>
              </CardTitle>
              <CardDescription>
                Desain telah selesai, namun peminta meminta adanya perbaikan
                atau perubahan.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <Badge variant="default">DONE</Badge>
              </CardTitle>
              <CardDescription>
                Pekerjaan telah selesai dari sisi desainer dan menunggu
                persetujuan akhir dari peminta.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <Badge variant="destructive">DIBATALKAN</Badge>
              </CardTitle>
              <CardDescription>
                Permintaan dibatalkan oleh admin karena alasan tertentu.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Content>

      <Content
        size="lg"
        title="Panduan untuk Peminta Desain"
        cardAction={<User />}
      >
        <div className="prose prose-stone dark:prose-invert max-w-none">
          <h4>1. Membuat Permintaan Baru</h4>
          <p>
            Untuk membuat permintaan, klik tombol{" "}
            <strong>&quot;Buat Permintaan Baru&quot;</strong> yang ada di
            halaman utama Anda. Isi semua field yang diperlukan dengan detail
            yang jelas untuk memudahkan desainer memahami kebutuhan Anda.
          </p>
          <h4>2. Melihat Daftar Permintaan</h4>
          <p>
            Semua permintaan yang pernah Anda buat dapat dilihat di halaman
            utama. Anda bisa menggunakan fitur pencarian dan filter untuk
            menemukan permintaan spesifik.
          </p>
          <h4>3. Menanggapi Permintaan yang Sudah &quot;DONE&quot;</h4>
          {/* PERBAIKAN DI SINI: <p> diubah menjadi <div> */}
          <div>
            Ketika status permintaan Anda berubah menjadi{" "}
            <Badge variant="default">DONE</Badge>, Anda memiliki dua pilihan:
          </div>
          <ul>
            <li>
              <strong>Minta Revisi:</strong> Jika hasil desain belum sepenuhnya
              sesuai, klik tombol ini. Anda akan diminta untuk memberikan
              catatan revisi yang jelas agar desainer dapat melakukan perbaikan.
              Status akan berubah menjadi{" "}
              <Badge variant="outline">REVISION</Badge>.
            </li>
            <li>
              <strong>Selesaikan & Beri Review:</strong> Jika Anda puas dengan
              hasilnya, klik tombol ini. Anda akan diminta untuk memberikan
              rating (skala 1-10) dan ulasan. Setelah ini, permintaan dianggap
              selesai sepenuhnya.
            </li>
          </ul>
        </div>
      </Content>

      <Content
        size="lg"
        title="Panduan untuk Admin/Desainer"
        cardAction={<ShieldCheck />}
      >
        <div className="prose prose-stone dark:prose-invert max-w-none">
          <h4>1. Melihat Dashboard & Daftar Permintaan</h4>
          <p>
            Halaman Dashboard memberikan ringkasan statistik semua permintaan.
            Untuk melihat daftar lengkap semua permintaan yang masuk, buka
            halaman <strong>&quot;Daftar Semua Permintaan&quot;</strong>.
          </p>
          {/* PERBAIKAN DI SINI: <p> diubah menjadi <div> */}
          <div>
            Pada halaman detail permintaan yang belum memiliki admin, klik
            tombol <strong>&quot;Ambil Permintaan&quot;</strong>. Ini akan
            menetapkan Anda sebagai penanggung jawab dan mengubah status menjadi{" "}
            <Badge variant="secondary">PROGRESS</Badge>.
          </div>
          {/* PERBAIKAN DI SINI: <p> diubah menjadi <div> */}
          <div>
            Di halaman detail, Anda memiliki panel admin untuk mengubah status
            pekerjaan dan mengunggah file hasil desain. Ketika pekerjaan
            selesai, ubah status ke <Badge variant="default">DONE</Badge> untuk
            meminta persetujuan dari user.
          </div>
        </div>
      </Content>

      <Content
        size="lg"
        title="Pertanyaan Umum (FAQ)"
        cardAction={<HelpCircle />}
      >
        <div className="prose prose-stone dark:prose-invert max-w-none">
          <h4>Berapa lama biasanya sebuah permintaan dikerjakan?</h4>
          <p>
            Waktu pengerjaan bervariasi tergantung pada kompleksitas permintaan.
            Namun, Anda selalu bisa memantau statusnya di halaman daftar
            permintaan Anda.
          </p>
          <div>
            Jika permintaan belum diambil oleh admin, Anda mungkin bisa
            mengeditnya. Namun jika sudah berstatus{" "}
            <Badge variant="secondary">PROGRESS</Badge>, silakan hubungi admin
            yang bersangkutan secara langsung untuk memberikan detail tambahan.
          </div>
          <h4>Siapa yang harus dihubungi jika ada masalah teknis?</h4>
          <p>
            Untuk masalah teknis terkait aplikasi, silakan hubungi tim IT atau
            kirim email ke{" "}
            <a href="mailto:support@example.com">support@example.com</a>.
          </p>
        </div>
      </Content>
    </>
  );
}
