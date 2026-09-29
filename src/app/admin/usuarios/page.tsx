import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { USER_ROLES, labelOf } from "@/lib/catalogs";
import { formatDateTime } from "@/lib/format";
import { listUsers } from "@/lib/users";

export const metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const me = await requirePermission("users.manage", "/admin/usuarios");
  const users = await listUsers();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Usuarios del panel</h1>
          <p className="text-sm text-slate-500">Quién puede entrar y con qué permisos.</p>
        </div>
        <Link href="/admin/usuarios/nuevo" className="btn-primary">
          + Nuevo usuario
        </Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="font-semibold">
                  {u.name}
                  {u.id === me.id ? <span className="ml-2 text-xs font-normal text-slate-500">(tú)</span> : null}
                </td>
                <td>{u.email}</td>
                <td>{labelOf(USER_ROLES, u.role)}</td>
                <td>
                  {!u.active ? (
                    <span className="badge-cancelado">Desactivado</span>
                  ) : u.mustChangePassword ? (
                    <span className="badge-lista_espera">Contraseña temporal</span>
                  ) : (
                    <span className="badge-confirmado">Activo</span>
                  )}
                </td>
                <td className="text-slate-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}</td>
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
    </div>
  );
}
