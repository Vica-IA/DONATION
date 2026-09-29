"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { log } from "@/lib/data";
import { isUniqueViolation } from "@/lib/db/errors";
import { generateTempPassword } from "@/lib/password";
import { countActiveAdmins, createUser, getUserById, setPassword, updateUser } from "@/lib/users";
import { flattenErrors, formToObject, passwordResetSchema, userCreateSchema, userUpdateSchema, type FieldErrors } from "@/lib/validation";

export type UserFormState = {
  errors: FieldErrors;
  values: Record<string, unknown>;
  saved?: boolean;
  credentials?: { email: string; password: string };
};

export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requirePermission("users.manage", "/admin/usuarios/nuevo");
  const raw = formToObject(formData);
  const parsed = userCreateSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };

  const password = parsed.data.password ?? generateTempPassword();
  try {
    const user = await createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      password,
      mustChangePassword: true,
    });
    await log("user", user.id, "creado", `${user.email} · rol ${user.role}`, actor.name);
  } catch (err) {
    if (!isUniqueViolation(err)) console.error("Error creando usuario", err);
    return {
      errors: { _form: isUniqueViolation(err) ? "Ya existe un usuario con ese correo." : "No fue posible crear el usuario." },
      values: raw,
    };
  }
  revalidatePath("/admin/usuarios");
  return { errors: {}, values: {}, saved: true, credentials: { email: parsed.data.email, password } };
}

export async function updateUserAction(id: string, _prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requirePermission("users.manage", `/admin/usuarios/${id}`);
  const target = await getUserById(id);
  if (!target) return { errors: { _form: "El usuario no existe." }, values: {} };
  const raw = formToObject(formData, [], ["active"]);
  const parsed = userUpdateSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };

  // Evita quedarse sin acceso: nadie se desactiva ni se degrada a sí mismo,
  // y siempre debe quedar al menos un administrador activo.
  if (actor.id === id && (!parsed.data.active || parsed.data.role !== "admin")) {
    return { errors: { _form: "No puedes desactivar ni cambiar el rol de tu propia cuenta." }, values: raw };
  }
  const losesAdmin = target.role === "admin" && target.active && (parsed.data.role !== "admin" || !parsed.data.active);
  if (losesAdmin && (await countActiveAdmins()) <= 1) {
    return { errors: { _form: "Debe quedar al menos un administrador activo." }, values: raw };
  }

  await updateUser(id, parsed.data);
  const changes: string[] = [];
  if (target.role !== parsed.data.role) changes.push(`rol ${target.role} → ${parsed.data.role}`);
  if (target.active !== parsed.data.active) changes.push(parsed.data.active ? "activado" : "desactivado");
  if (target.name !== parsed.data.name) changes.push("nombre editado");
  await log("user", id, "actualizado", changes.join("; ") || "sin cambios", actor.name);
  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${id}`);
  return { errors: {}, values: {}, saved: true };
}

export async function resetPasswordAction(id: string, _prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requirePermission("users.manage", `/admin/usuarios/${id}`);
  const target = await getUserById(id);
  if (!target) return { errors: { _form: "El usuario no existe." }, values: {} };
  const parsed = passwordResetSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: {} };

  const password = parsed.data.password ?? generateTempPassword();
  await setPassword(id, password, true);
  await log("user", id, "contrasena_restablecida", "contraseña temporal asignada", actor.name);
  revalidatePath(`/admin/usuarios/${id}`);
  return { errors: {}, values: {}, saved: true, credentials: { email: target.email, password } };
}
