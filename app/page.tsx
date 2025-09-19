// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { PlusCircle, Settings, List, Search } from "lucide-react";

// Definisikan tipe data untuk user dan request
interface User {
  id: number;
  name: string;
  email: string;
  department: string;
  role: "user" | "admin";
}

interface Request {
  id: number;
  userId: number;
  name: string;
  email: string;
  department: string;
  date: string;
  deadline: string;
  project: string;
  purpose: string;
  additionalInfo: string;
  copywriting: string;
  status: "Progress" | "Done";
  createdAt: string;
  designFile?: string;
}

const DEPARTMENTS = [
  "BOD",
  "Executive Manager",
  "HR",
  "GA",
  "HSE",
  "Finance",
  "Marketing",
  "Manufaktur",
  "Service",
  "IT",
];

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [newRequest, setNewRequest] = useState({
    project: "",
    deadline: "",
    purpose: "",
    additionalInfo: "",
    copywriting: "",
  });

  // Ambil data user dari localStorage saat komponen pertama kali dimuat
  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    const savedRequests = JSON.parse(
      localStorage.getItem("designRequests") || "[]"
    );

    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else {
      router.push("/auth/login"); // Arahkan ke halaman login jika tidak ada user
    }
    setRequests(savedRequests);
  }, [router]);

  if (!currentUser) {
    return null; // Atau tampilkan loading state
  }

  // Event handler untuk form
  const handleNewRequestChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setNewRequest({ ...newRequest, [name]: value });
  };

  const submitDesignRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const newReq: Request = {
      id: Date.now(),
      userId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      department: currentUser.department,
      date: new Date().toISOString().split("T")[0],
      deadline: newRequest.deadline,
      project: newRequest.project,
      purpose: newRequest.purpose,
      additionalInfo: newRequest.additionalInfo,
      copywriting: newRequest.copywriting,
      status: "Progress",
      createdAt: new Date().toISOString(),
    };

    const updatedRequests = [...requests, newReq];
    localStorage.setItem("designRequests", JSON.stringify(updatedRequests));
    setRequests(updatedRequests);
    toast.success("Permintaan desain berhasil dikirim!");
    // Pindah ke tab "Daftar Permintaan" setelah submit
    // Catatan: Ini akan memerlukan state tambahan untuk mengelola tab aktif
    // Saat ini, Anda bisa menyegarkan halaman atau menggunakan state.
  };

  const logout = () => {
    localStorage.removeItem("currentUser");
    router.push("/auth/login");
  };

  const userRequests = requests.filter((req) => req.userId === currentUser.id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <a className="font-bold text-lg text-indigo-600" href="#">
            <span className="text-2xl mr-2">🗃️</span>Helpdesk Desain
          </a>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 hidden md:inline">
              Selamat datang, **{currentUser.name}**
            </span>
            <Button
              onClick={logout}
              variant="outline"
              className="text-red-500 hover:text-red-600"
            >
              Keluar
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto py-28 px-4">
        <Tabs defaultValue="request" className="w-full">
          <TabsList>
            <TabsTrigger value="request">
              <PlusCircle className="w-4 h-4 mr-2" /> Permintaan Baru
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="w-4 h-4 mr-2" /> Daftar Permintaan
            </TabsTrigger>
            {currentUser.role === "admin" && (
              <TabsTrigger value="admin">
                <Settings className="w-4 h-4 mr-2" /> Admin Panel
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tab Content: Form Permintaan Baru */}
          <TabsContent value="request" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Form Permintaan Desain</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitDesignRequest} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Nama</label>
                      <Input value={currentUser.name} disabled />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input value={currentUser.email} disabled />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Departemen</label>
                      <Select value={currentUser.department} disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Departemen" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Tanggal</label>
                      <Input
                        type="date"
                        value={new Date().toISOString().split("T")[0]}
                        disabled
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Deadline</label>
                      <Input
                        type="date"
                        name="deadline"
                        onChange={handleNewRequestChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Project</label>
                      <Input
                        type="text"
                        name="project"
                        onChange={handleNewRequestChange}
                        placeholder="Nama project..."
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">
                        Tujuan Desain
                      </label>
                      <Textarea
                        name="purpose"
                        onChange={handleNewRequestChange}
                        placeholder="Jelaskan tujuan desain..."
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Informasi Tambahan
                      </label>
                      <Textarea
                        name="additionalInfo"
                        onChange={handleNewRequestChange}
                        placeholder="Info lain-lain..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Copywriting / Teks
                      </label>
                      <Textarea
                        name="copywriting"
                        onChange={handleNewRequestChange}
                        placeholder="Masukkan teks yang diperlukan..."
                      />
                    </div>
                    <Button type="submit" className="w-full md:w-auto">
                      Kirim Permintaan
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Content: Daftar Permintaan */}
          <TabsContent value="list" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Daftar Permintaan Anda</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Departemen</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>{req.project}</TableCell>
                        <TableCell>{req.department}</TableCell>
                        <TableCell>{req.deadline}</TableCell>
                        <TableCell>{req.status}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            <Search className="w-4 h-4 mr-2" /> Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Content: Admin Panel */}
          {currentUser.role === "admin" && (
            <TabsContent value="admin" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Admin Panel</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Panel admin akan ditampilkan di sini.</p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
