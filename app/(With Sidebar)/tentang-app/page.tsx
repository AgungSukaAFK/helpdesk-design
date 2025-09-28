"use client";

import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";

// Data Developer Placeholder
// const developers = [
//   {
//     name: "Budi Santoso",
//     role: "Lead Developer / Full-Stack",
//     avatarUrl: "https://placehold.co/128x128/EFEFEF/777777?text=BS",
//     fallback: "BS",
//     bio: "Seorang pengembang perangkat lunak dengan hasrat untuk membangun aplikasi yang efisien dan solutif. Berfokus pada arsitektur back-end yang kuat dan integrasi yang mulus.",
//     socials: {
//       github: "#",
//       linkedin: "#",
//       email: "mailto:budi.santoso@example.com",
//     },
//   },
//   {
//     name: "Citra Lestari",
//     role: "UI/UX Designer / Frontend",
//     avatarUrl: "https://placehold.co/128x128/EFEFEF/777777?text=CL",
//     fallback: "CL",
//     bio: "Desainer yang berfokus pada pengalaman pengguna yang intuitif dan antarmuka yang bersih. Bersemangat dalam mengubah ide-ide kompleks menjadi desain yang mudah digunakan.",
//     socials: {
//       github: "#",
//       linkedin: "#",
//       email: "mailto:citra.lestari@example.com",
//     },
//   },
// ];

export default function TentangAppPage() {
  return (
    // Container Grid Utama untuk mengatur tata letak Content
    <>
      <Content size="lg" title="Tentang Aplikasi Helpdesk Desain">
        <div className="prose prose-stone dark:prose-invert max-w-none">
          <p>
            Selamat datang di Aplikasi Helpdesk Desain! Platform ini dirancang
            untuk menjembatani komunikasi antara berbagai departemen dengan tim
            desainer, memastikan setiap permintaan dapat dikelola dengan
            efisien, transparan, dan terstruktur.
          </p>
          <p>
            Tujuan utama kami adalah menyederhanakan alur kerja, mulai dari
            pengajuan ide, proses pengerjaan, revisi, hingga penyelesaian
            proyek. Dengan sistem ini, kami berharap dapat mengurangi
            miskomunikasi, mempercepat waktu pengerjaan, dan memberikan hasil
            desain berkualitas tinggi yang sesuai dengan kebutuhan.
          </p>
        </div>
      </Content>

      <Content size="lg" title="Teknologi yang Digunakan">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Next.js</Badge>
          <Badge variant="outline">React</Badge>
          <Badge variant="outline">TypeScript</Badge>
          <Badge variant="outline">Supabase</Badge>
          <Badge variant="outline">PostgreSQL</Badge>
          <Badge variant="outline">Tailwind CSS</Badge>
          <Badge variant="outline">shadcn/ui</Badge>
          <Badge variant="outline">Vercel</Badge>
        </div>
      </Content>
    </>
  );
}
