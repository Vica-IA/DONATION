import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import type { Area, UserRole } from "./catalogs";
import { getDb } from "./db";
import { organizations, users, type User } from "./db/schema";
import { nowIso } from "./format";
import { hashPassword } from "./password";

export type PublicUser = Omit<User, "passwordHash"> & { organizationName: string | null };

function strip(user: User, organizationName: string | null = null): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return { ...rest, organizationName };
}

export async function listUsers(): Promise<PublicUser[]> {
  const db = await getDb();
  const rows = await db
    .select({ user: users, organizationName: organizations.name })
    .from(users)
    .leftJoin(organizations, eq(organizations.id, users.organizationId))
    .orderBy(asc(users.name));
  return rows.map((r) => strip(r.user, r.organizationName));
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const db = await getDb();
  const row = (
    await db
      .select({ user: users, organizationName: organizations.name })
      .from(users)
      .leftJoin(organizations, eq(organizations.id, users.organizationId))
      .where(eq(users.id, id))
      .limit(1)
  )[0];
  return row ? strip(row.user, row.organizationName) : null;
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

/** Coordinadores activos, indexados por área. */
export async function listCoordinators(): Promise<Map<Area, PublicUser>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "coordinador"), eq(users.active, true)))
    .orderBy(asc(users.name));
  const map = new Map<Area, PublicUser>();
  for (const u of rows) if (u.area && !map.has(u.area as Area)) map.set(u.area as Area, strip(u));
  return map;
}

/** Líderes de grupo activos, indexados por organización. */
export async function listLeaders(): Promise<Map<string, PublicUser[]>> {
  const db = await getDb();
  const rows = await db
    .select({ user: users, organizationName: organizations.name })
    .from(users)
    .leftJoin(organizations, eq(organizations.id, users.organizationId))
    .where(and(eq(users.role, "lider_grupo"), eq(users.active, true)))
    .orderBy(asc(users.name));
  const map = new Map<string, PublicUser[]>();
  for (const r of rows) {
    if (!r.user.organizationId) continue;
    const list = map.get(r.user.organizationId) ?? [];
    list.push(strip(r.user, r.organizationName));
    map.set(r.user.organizationId, list);
  }
  return map;
}

/** Usuarios activos que pueden ser responsables de tareas. */
export async function listAssignableUsers(): Promise<PublicUser[]> {
  return (await listUsers()).filter((u) => u.active && u.role !== "consulta");
}

type ScopeInput = { organizationId: string | null; area: Area | null; phone: string | null };

export async function createUser(input: {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  mustChangePassword: boolean;
} & ScopeInput): Promise<PublicUser> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    name: input.name,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    organizationId: input.organizationId,
    area: input.area,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    active: true,
    mustChangePassword: input.mustChangePassword,
  });
  return (await getUserById(id))!;
}

export async function updateUser(id: string, input: { name: string; role: UserRole; active: boolean } & ScopeInput): Promise<void> {
  const db = await getDb();
  await db
    .update(users)
    .set({
      name: input.name,
      role: input.role,
      active: input.active,
      organizationId: input.organizationId,
      area: input.area,
      phone: input.phone,
      updatedAt: nowIso(),
    })
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
