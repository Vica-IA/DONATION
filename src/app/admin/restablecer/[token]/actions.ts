"use server";

import { redirect } from "next/navigation";
import { issueSession } from "@/lib/auth";
import { completePasswordReset } from "@/lib/password-reset";
import { touchLastLogin } from "@/lib/users";
import { flattenErrors, formToObject, resetWithTokenSchema, type FieldErrors } from "@/lib/validation";

export type ResetState = { errors: FieldErrors };

const INVALID = "Este enlace no es válido, ya se usó o venció. Pide a un administrador uno nuevo.";

export async function resetWithTokenAction(token: string, _prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = resetWithTokenSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { errors: flattenErrors(parsed.error) };
  const user = await completePasswordReset(token, parsed.data.newPassword);
  if (!user) return { errors: { _form: INVALID } };
  await issueSession(user.id);
  await touchLastLogin(user.id);
  redirect("/admin?cuenta=ok");
}
