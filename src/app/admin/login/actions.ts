"use server";

import { redirect } from "next/navigation";
import { loginWithPassword } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const result = await loginWithPassword(password);
  if (!result.ok) return { error: result.error };
  // Evita redirecciones abiertas: solo rutas internas del panel.
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}
