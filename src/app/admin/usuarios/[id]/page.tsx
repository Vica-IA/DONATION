import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getUserById } from "@/lib/users";
import { EditUserForm, ResetPasswordForm } from "../user-forms";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requirePermission("users.manage", `/admin/usuarios/${id}`);
  const user = await getUserById(id);
  if (!user) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/usuarios" className="text-xs text-slate-500 hover:text-brand-700">
          ← Usuarios
        </Link>
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <p className="text-sm text-slate-500">
          {user.email} · creado {formatDateTime(user.createdAt)}
          {user.lastLoginAt ? ` · último acceso ${formatDateTime(user.lastLoginAt)}` : " · nunca ha entrado"}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <EditUserForm user={user} isSelf={user.id === me.id} />
        <ResetPasswordForm user={user} />
      </div>
    </div>
  );
}
