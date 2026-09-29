"use server";

import { redirect } from "next/navigation";
import { loginWithCredentials } from "@/lib/auth";
import { flattenErrors, loginSchema } from "@/lib/validation";

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const next = String(formData.get("next") ?? "/admin");
  if (!parsed.success) {
    const errors = flattenErrors(parsed.error);
    return { error: errors.email ?? errors.password ?? "Revisa los datos.", email: String(formData.get("email") ?? "") };
  }
  const result = await loginWithCredentials(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error, email: parsed.data.email };
  if (result.mustChangePassword) redirect("/admin/cuenta?obligatorio=1");
  // Evita redirecciones abiertas: solo rutas internas del panel.
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}
