import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ingresar al panel" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await isAdmin()) redirect(next && next.startsWith("/admin") ? next : "/admin");
  const devHint = !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";

  return (
    <main className="container-narrow flex flex-1 flex-col items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          <h1 className="text-lg font-semibold">Panel del equipo</h1>
          <p className="mb-4 mt-1 text-sm text-slate-500">Acceso para coordinación de misiones.</p>
          <LoginForm next={next ?? "/admin"} />
          {devHint ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              Modo desarrollo: no hay <code>ADMIN_PASSWORD</code> definida, usa <code>donato2026</code>.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
