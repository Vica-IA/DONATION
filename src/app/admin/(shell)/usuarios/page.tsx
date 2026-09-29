import Link from "next/link";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { USER_ROLES, areaInfo, labelOf } from "@/lib/catalogs";
import { formatDateTime } from "@/lib/format";
import { listUsers } from "@/lib/users";

export const metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const me = await requirePermission("users.manage", "/admin/usuarios");
  const users = await listUsers();
  return (
    <>
      <PageHeader
        kicker="Equipo"
        title="Usuarios del panel"
        actions={
          <Link href="/admin/usuarios/nuevo" className="btn-primary">
            + Nuevo usuario
          </Link>
        }
      />
      <PageBody>
      <p className="text-sm text-muted">Quién puede entrar y con qué permisos. Los líderes ven su grupo; los coordinadores gestionan su área.</p>
      <div className="card-tight overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Alcance</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-paper-2">
                <td className="font-semibold">
                  {u.name}
                  {u.id === me.id ? <span className="ml-2 text-xs font-normal text-muted">(tú)</span> : null}
                </td>
                <td>{u.email}</td>
                <td>{labelOf(USER_ROLES, u.role)}</td>
                <td className="text-muted">{u.role === "lider_grupo" ? (u.organizationName ?? "Sin grupo") : u.role === "coordinador" ? (u.area ? areaInfo(u.area).label : "Sin área") : "—"}</td>
                <td>
                  {!u.active ? (
                    <span className="badge-cancelado">Desactivado</span>
                  ) : u.mustChangePassword ? (
                    <span className="badge-lista_espera">Contraseña temporal</span>
                  ) : (
                    <span className="badge-confirmado">Activo</span>
                  )}
                </td>
                <td className="text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}</td>
                <td>
                  <Link href={`/admin/usuarios/${u.id}`} className="btn-ghost px-2 py-1 text-xs">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </PageBody>
    </>
  );
}
