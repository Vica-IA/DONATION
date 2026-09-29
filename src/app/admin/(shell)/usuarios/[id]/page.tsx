import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { listOrganizations } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { getUserById } from "@/lib/users";
import { EditUserForm, ResetLinkForm, ResetPasswordForm } from "../user-forms";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requirePermission("users.manage", `/admin/usuarios/${id}`);
  const [user, organizations] = await Promise.all([getUserById(id), listOrganizations()]);
  if (!user) notFound();
  return (
    <>
      <PageHeader
        kicker="Usuarios"
        title={user.name}
        badge={
          <span className="text-xs text-muted">
            {user.email} · creado {formatDateTime(user.createdAt)}
            {user.lastLoginAt ? ` · último acceso ${formatDateTime(user.lastLoginAt)}` : " · nunca ha entrado"}
          </span>
        }
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <EditUserForm user={user} isSelf={user.id === me.id} organizations={organizations.map((o) => ({ id: o.id, name: o.name }))} />
          {user.id === me.id ? (
            <div className="card space-y-3 text-sm">
              <h2 className="section-title">Tu contraseña</h2>
              <p className="text-muted">Esta es tu propia cuenta. Cámbiala desde Mi cuenta: restablecerla aquí cerraría tu sesión con una contraseña temporal.</p>
              <Link href="/admin/cuenta" className="btn-secondary w-fit">
                Ir a Mi cuenta
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <ResetLinkForm user={user} />
              <ResetPasswordForm user={user} />
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}
