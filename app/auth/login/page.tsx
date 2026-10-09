import { LoginForm } from "@/components/login-form";
import { AppearanceSwitchers } from "@/components/theme-switcher";

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <AppearanceSwitchers className="absolute right-4 top-4 flex items-center gap-1" />
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
