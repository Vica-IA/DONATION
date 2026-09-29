import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { siteUrl } from "./config";
import { log } from "./data";
import { getDb } from "./db";
import { passwordResets, users } from "./db/schema";
import { nowIso } from "./format";
import { setPassword } from "./users";

/** Vigencia de un enlace de restablecimiento. */
export const RESET_TTL_HOURS = 48;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetUrl(token: string): string {
  return `${siteUrl()}/admin/restablecer/${token}`;
}

/**
 * Crea un enlace de un solo uso para un usuario. Los enlaces anteriores sin
 * usar de esa persona dejan de servir. El token solo existe en el enlace: en
 * la base queda su SHA-256.
 */
export async function createPasswordReset(userId: string, actor: string): Promise<{ token: string; expiresAt: string }> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await db.delete(passwordResets).where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)));
  await db.insert(passwordResets).values({ id: crypto.randomUUID(), userId, tokenHash: hashToken(token), expiresAt, createdBy: actor });
  await log("user", userId, "enlace_restablecimiento", `vence ${expiresAt}`, actor);
  return { token, expiresAt };
}

export type ActiveReset = { id: string; expiresAt: string; user: { id: string; name: string; email: string } };

/** Enlace vigente: existe, no se ha usado, no ha vencido y la cuenta está activa. */
export async function findActiveReset(token: string): Promise<ActiveReset | null> {
  if (!token || token.length > 128) return null;
  const db = await getDb();
  const row = (
    await db
      .select({ reset: passwordResets, user: { id: users.id, name: users.name, email: users.email, active: users.active } })
      .from(passwordResets)
      .innerJoin(users, eq(users.id, passwordResets.userId))
      .where(eq(passwordResets.tokenHash, hashToken(token)))
      .limit(1)
  )[0];
  if (!row || row.reset.usedAt || row.reset.expiresAt < nowIso() || !row.user.active) return null;
  return { id: row.reset.id, expiresAt: row.reset.expiresAt, user: { id: row.user.id, name: row.user.name, email: row.user.email } };
}

/** Fija la nueva contraseña y consume el enlace. Devuelve el usuario o null si el enlace no sirve. */
export async function completePasswordReset(token: string, newPassword: string): Promise<ActiveReset["user"] | null> {
  const active = await findActiveReset(token);
  if (!active) return null;
  const db = await getDb();
  const now = nowIso();
  await setPassword(active.user.id, newPassword, false);
  await db.update(passwordResets).set({ usedAt: now }).where(and(eq(passwordResets.userId, active.user.id), isNull(passwordResets.usedAt)));
  await log("user", active.user.id, "contrasena_restablecida", "nueva contraseña creada desde el enlace", active.user.name);
  return active.user;
}
