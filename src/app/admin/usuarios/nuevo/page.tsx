import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { CreateUserForm } from "../user-forms";

export const metadata = { title: "Nuevo usuario" };

export default async function NewUserPage() {
  await requirePermission("users.manage", "/admin/usuarios/nuevo");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin/usuarios" className="text-xs text-slate-500 hover:text-brand-700">
          ← Usuarios
        </Link>
        <h1 className="text-2xl font-bold">Nuevo usuario</h1>
      </div>
      <CreateUserForm />
    </div>
  );
}
