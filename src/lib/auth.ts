import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "./catalogs";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, authSecret, createSessionToken, verifySessionToken } from "./auth-core";
import { can, isUserRole, type Permission } from "./permissions";
import { verifyPassword } from "./password";
import { getUserWithHashByEmail, getUserWithHashById, touchLastLogin } from "./users";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
};

/** Usuario de la sesión actual (o null). Se memoriza por petición. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const claims = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await getUserWithHashById(claims.userId);
  if (!user || !user.active || !isUserRole(user.role)) return null;
  // Un cambio de contraseña invalida las sesiones anteriores.
  const changedAt = Math.floor(Date.parse(user.passwordChangedAt) / 1000);
  if (Number.isFinite(changedAt) && claims.iat < changedAt) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword };
});

/**
 * Exige sesión. Redirige al login si no hay, y a "Mi cuenta" si la contraseña
 * es temporal y aún no se ha cambiado.
 */
export async function requireUser(nextPath: string, options: { allowPendingPassword?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  if (user.mustChangePassword && !options.allowPendingPassword) redirect("/admin/cuenta?obligatorio=1");
  return user;
}

/** Exige sesión y un permiso concreto. Sin permiso, vuelve al panel con aviso. */
export async function requirePermission(permission: Permission, nextPath: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!can(user.role, permission)) redirect("/admin?denegado=1");
  return user;
}

export type LoginResult = { ok: true; mustChangePassword: boolean } | { ok: false; error: string };

// Límite de intentos por correo (mejor esfuerzo; en serverless es por instancia).
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function tooManyAttempts(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() > entry.resetAt) attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  else entry.count += 1;
}

export async function loginWithCredentials(email: string, password: string): Promise<LoginResult> {
  const key = email.trim().toLowerCase();
  if (!authSecret()) {
    return { ok: false, error: "Falta configurar AUTH_SECRET en el servidor." };
  }
  if (tooManyAttempts(key)) {
    return { ok: false, error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." };
  }
  const user = await getUserWithHashByEmail(key);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    recordFailure(key);
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }
  if (!user.active) {
    return { ok: false, error: "Esta cuenta está desactivada. Contacta a un administrador." };
  }
  attempts.delete(key);
  await issueSession(user.id);
  await touchLastLogin(user.id);
  return { ok: true, mustChangePassword: user.mustChangePassword };
}

/** Emite (o renueva) la cookie de sesión del usuario. */
export async function issueSession(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  if (!token) throw new Error("No fue posible crear la sesión (AUTH_SECRET).");
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
