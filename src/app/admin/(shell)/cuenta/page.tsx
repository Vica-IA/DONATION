import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { USER_ROLES, areaInfo, labelOf } from "@/lib/catalogs";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";
import { ChangePasswordForm } from "./form";

export const metadata = { title: "Mi cuenta" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ obligatorio?: string }> }) {
  const user = await requireUser("/admin/cuenta", { allowPendingPassword: true });
  const { obligatorio } = await searchParams;
  return (
    <>
      <PageHeader kicker="Equipo" title="Mi cuenta" badge={<span className="text-xs text-muted">{user.email}</span>} />
      <PageBody>
        <div className="mx-auto w-full max-w-2xl space-y-5">
          <div className="card-tight text-sm">
            <p className="font-semibold">
              {user.name} · {labelOf(USER_ROLES, user.role)}
              {user.area ? ` · ${areaInfo(user.area).label}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted">{ROLE_DESCRIPTIONS[user.role]}</p>
          </div>
          {obligatorio || user.mustChangePassword ? (
            <div className="rounded-xl border border-amber-200 bg-warn-soft p-4 text-sm text-warn" role="alert">
              Tu contraseña es temporal. Debes cambiarla antes de usar el panel.
            </div>
          ) : null}
          <ChangePasswordForm />
        </div>
      </PageBody>
    </>
  );
}
