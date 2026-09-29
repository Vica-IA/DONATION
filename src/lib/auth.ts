import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  adminPassword,
  createSessionToken,
  timingSafeEqual,
  verifySessionToken,
} from "./auth-core";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Úsalo al inicio de cada página y acción del panel: redirige al login si no hay sesión. */
export async function requireAdmin(nextPath = "/admin"): Promise<void> {
  if (!(await isAdmin())) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function loginWithPassword(password: string): Promise<LoginResult> {
  const expected = adminPassword();
  if (!expected) {
    return { ok: false, error: "El panel no tiene contraseña configurada (ADMIN_PASSWORD)." };
  }
  if (!timingSafeEqual(password, expected)) {
    return { ok: false, error: "Contraseña incorrecta." };
  }
  const token = await createSessionToken();
  if (!token) return { ok: false, error: "No fue posible crear la sesión." };
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
