import Link from "next/link";
import { Logo } from "@/components/brand";
import { getSessionUser } from "@/lib/auth";
import { USER_ROLES, labelOf } from "@/lib/catalogs";
import { can } from "@/lib/permissions";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) return <>{children}</>; // pantalla de login

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-brand-900 text-white">
        <div className="container-wide flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
          <Logo href="/admin" light />
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-white/10">
              Misiones
            </Link>
            {can(user.role, "users.manage") ? (
              <Link href="/admin/usuarios" className="rounded-lg px-3 py-2 hover:bg-white/10">
                Usuarios
              </Link>
            ) : null}
            <Link href="/" className="rounded-lg px-3 py-2 hover:bg-white/10" target="_blank">
              Sitio público
            </Link>
            <Link href="/admin/cuenta" className="rounded-lg px-3 py-2 hover:bg-white/10" title={user.email}>
              <span className="font-medium">{user.name}</span>
              <span className="ml-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{labelOf(USER_ROLES, user.role)}</span>
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
