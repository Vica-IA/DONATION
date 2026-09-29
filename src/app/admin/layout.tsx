import Link from "next/link";
import { Logo } from "@/components/brand";
import { isAdmin } from "@/lib/auth";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdmin();
  if (!authed) return <>{children}</>; // pantalla de login

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-brand-900 text-white">
        <div className="container-wide flex h-16 items-center justify-between">
          <Logo href="/admin" light />
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-white/10">
              Misiones
            </Link>
            <Link href="/" className="rounded-lg px-3 py-2 hover:bg-white/10" target="_blank">
              Sitio público
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg px-3 py-2 text-white/80 hover:bg-white/10">
                Salir
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="container-wide flex-1 py-8">{children}</main>
    </div>
  );
}
