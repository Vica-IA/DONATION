"use server";

import { redirect } from "next/navigation";
import { issueSession, requireUser } from "@/lib/auth";
import { log } from "@/lib/data";
import { verifyPassword } from "@/lib/password";
import { getUserWithHashById, setPassword } from "@/lib/users";
import { changePasswordSchema, flattenErrors, formToObject, type FieldErrors } from "@/lib/validation";

export type ChangePasswordState = { errors: FieldErrors };

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const session = await requireUser("/admin/cuenta", { allowPendingPassword: true });
  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { errors: flattenErrors(parsed.error) };

  const user = await getUserWithHashById(session.id);
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { errors: { currentPassword: "La contraseña actual no es correcta." } };
  }
  await setPassword(user.id, parsed.data.newPassword, false);
  // Las demás sesiones quedan invalidadas; esta se renueva.
  await issueSession(user.id);
  await log("user", user.id, "contrasena_cambiada", null, user.name);
  redirect("/admin?cuenta=ok");
}
