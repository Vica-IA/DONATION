import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { listOrganizations } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { getUserById } from "@/lib/users";
import { EditUserForm, ResetPasswordForm } from "../user-forms";

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
          <ResetPasswordForm user={user} />
        </div>
      </PageBody>
    </>
  );
}
