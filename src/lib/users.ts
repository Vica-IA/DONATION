import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import type { UserRole } from "./catalogs";
import { getDb } from "./db";
import { users, type User } from "./db/schema";
import { nowIso } from "./format";
import { hashPassword } from "./password";

export type PublicUser = Omit<User, "passwordHash">;

function strip(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return rest;
}

export async function listUsers(): Promise<PublicUser[]> {
  const db = await getDb();
  const rows = await db.select().from(users).orderBy(asc(users.name));
  return rows.map(strip);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const db = await getDb();
  const row = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  return row ? strip(row) : null;
}

/** Incluye el hash: solo para verificar credenciales. */
export async function getUserWithHashByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const row = (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0];
  return row ?? null;
}

export async function getUserWithHashById(id: string): Promise<User | null> {
  const db = await getDb();
  const row = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  return row ?? null;
}

export async function countActiveAdmins(): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true)));
  return n;
}

export async function createUser(input: {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  mustChangePassword: boolean;
}): Promise<PublicUser> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    name: input.name,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    passwordHash: await hashPassword(input.password),
    active: true,
    mustChangePassword: input.mustChangePassword,
  });
  return (await getUserById(id))!;
}

export async function updateUser(id: string, input: { name: string; role: UserRole; active: boolean }): Promise<void> {
  const db = await getDb();
  await db
    .update(users)
    .set({ name: input.name, role: input.role, active: input.active, updatedAt: nowIso() })
    .where(eq(users.id, id));
}

/**
 * Cambia la contraseña. Actualiza password_changed_at, lo que invalida las
 * sesiones emitidas antes (ver auth.ts). `temporary` obliga a cambiarla al entrar.
 */
export async function setPassword(id: string, password: string, temporary: boolean): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: temporary, passwordChangedAt: now, updatedAt: now })
    .where(eq(users.id, id));
}

export async function touchLastLogin(id: string): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ lastLoginAt: nowIso() }).where(eq(users.id, id));
}
