import { PageBody, PageHeader } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { listOrganizations } from "@/lib/data";
import { CreateUserForm } from "../user-forms";

export const metadata = { title: "Nuevo usuario" };

export default async function NewUserPage() {
  await requirePermission("users.manage", "/admin/usuarios/nuevo");
  const organizations = await listOrganizations();
  return (
    <>
      <PageHeader kicker="Usuarios" title="Nuevo usuario" />
      <PageBody>
        <div className="mx-auto w-full max-w-2xl">
          <CreateUserForm organizations={organizations.map((o) => ({ id: o.id, name: o.name }))} />
        </div>
      </PageBody>
    </>
  );
}
