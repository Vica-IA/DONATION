import { requireUser } from "@/lib/auth";
import { USER_ROLES, labelOf } from "@/lib/catalogs";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";
import { ChangePasswordForm } from "./form";

export const metadata = { title: "Mi cuenta" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ obligatorio?: string }> }) {
  const user = await requireUser("/admin/cuenta", { allowPendingPassword: true });
  const { obligatorio } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="text-sm text-slate-500">
          {user.name} · {user.email} · {labelOf(USER_ROLES, user.role)}
        </p>
        <p className="mt-1 text-xs text-slate-500">{ROLE_DESCRIPTIONS[user.role]}</p>
      </div>
      {obligatorio || user.mustChangePassword ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="alert">
          Tu contraseña es temporal. Debes cambiarla antes de usar el panel.
        </div>
      ) : null}
      <ChangePasswordForm />
    </div>
  );
}
