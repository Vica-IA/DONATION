import "server-only";
import { asc, count, desc, eq, inArray, notInArray } from "drizzle-orm";
import { log } from "./data";
import { getDb } from "./db";
import {
  activityLog,
  financeEntries,
  missionRegistrations,
  missions,
  organizations,
  tasks,
  termsAcceptances,
  users,
  volunteers,
  type Volunteer,
} from "./db/schema";

/**
 * Diagnóstico de datos para el administrador: conteos reales por tabla,
 * todas las inscripciones sin filtrar por misión y la bitácora de
 * inscripciones. Sirve para responder "¿dónde están los registros?" sin
 * tocar la base por fuera de la aplicación.
 */

export type TableCount = { table: string; label: string; n: number };

export async function tableCounts(): Promise<TableCount[]> {
  const db = await getDb();
  const [reg, vol, acc, mis, org, usr, tsk, fin, act] = await Promise.all([
    db.select({ n: count() }).from(missionRegistrations),
    db.select({ n: count() }).from(volunteers),
    db.select({ n: count() }).from(termsAcceptances),
    db.select({ n: count() }).from(missions),
    db.select({ n: count() }).from(organizations),
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(tasks),
    db.select({ n: count() }).from(financeEntries),
    db.select({ n: count() }).from(activityLog),
  ]);
  return [
    { table: "mission_registrations", label: "Inscripciones", n: reg[0].n },
    { table: "volunteers", label: "Personas", n: vol[0].n },
    { table: "terms_acceptances", label: "Condiciones aceptadas", n: acc[0].n },
    { table: "missions", label: "Misiones", n: mis[0].n },
    { table: "organizations", label: "Grupos", n: org[0].n },
    { table: "users", label: "Usuarios del panel", n: usr[0].n },
    { table: "tasks", label: "Tareas", n: tsk[0].n },
    { table: "finance_entries", label: "Movimientos financieros", n: fin[0].n },
    { table: "activity_log", label: "Entradas de bitácora", n: act[0].n },
  ];
}

export type MissionSummary = { id: string; code: string; name: string; slug: string; registrationOpen: boolean; status: string; createdAt: string };

export async function listMissionsRaw(): Promise<MissionSummary[]> {
  const db = await getDb();
  return db
    .select({
      id: missions.id,
      code: missions.code,
      name: missions.name,
      slug: missions.slug,
      registrationOpen: missions.registrationOpen,
      status: missions.status,
      createdAt: missions.createdAt,
    })
    .from(missions)
    .orderBy(asc(missions.createdAt));
}

export type RawRegistration = {
  registration: typeof missionRegistrations.$inferSelect;
  volunteer: Volunteer | null;
  mission: { id: string; code: string; name: string } | null;
  organization: { name: string } | null;
  acceptedAt: string | null;
};

/** Todas las inscripciones de la base, con uniones externas: las huérfanas (sin misión o sin persona) también salen. */
export async function listAllRegistrations(): Promise<RawRegistration[]> {
  const db = await getDb();
  const rows = await db
    .select({
      registration: missionRegistrations,
      volunteer: volunteers,
      mission: { id: missions.id, code: missions.code, name: missions.name },
      organization: { name: organizations.name },
    })
    .from(missionRegistrations)
    .leftJoin(volunteers, eq(volunteers.id, missionRegistrations.volunteerId))
    .leftJoin(missions, eq(missions.id, missionRegistrations.missionId))
    .leftJoin(organizations, eq(organizations.id, volunteers.organizationId))
    .orderBy(asc(missionRegistrations.createdAt));
  const acceptances = await db
    .select({ registrationId: termsAcceptances.registrationId, acceptedAt: termsAcceptances.acceptedAt })
    .from(termsAcceptances)
    .orderBy(asc(termsAcceptances.acceptedAt));
  const byRegistration = new Map(acceptances.map((a) => [a.registrationId, a.acceptedAt]));
  return rows.map((r) => ({ ...r, acceptedAt: byRegistration.get(r.registration.id) ?? null }));
}

/** Personas registradas que no tienen ninguna inscripción (no deberían existir). */
export async function listVolunteersWithoutRegistration(): Promise<Volunteer[]> {
  const db = await getDb();
  const linked = await db.select({ id: missionRegistrations.volunteerId }).from(missionRegistrations);
  const set = new Set(linked.map((l) => l.id));
  const all = await db.select().from(volunteers).orderBy(asc(volunteers.fullName));
  return all.filter((v) => !set.has(v.id));
}

/** Bitácora de inscripciones, personas y misiones (lo más reciente primero). */
export async function registrationActivity(limit = 400) {
  const db = await getDb();
  return db
    .select()
    .from(activityLog)
    .where(inArray(activityLog.entityType, ["registration", "volunteer", "mission"]))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}

/**
 * Vincula a la misión indicada las inscripciones cuya misión ya no existe.
 * No toca inscripciones que sí tienen misión. Devuelve cuántas cambió.
 */
export async function relinkOrphanRegistrations(targetMissionId: string, actor: string): Promise<number> {
  const db = await getDb();
  const target = (await db.select({ id: missions.id, name: missions.name }).from(missions).where(eq(missions.id, targetMissionId)).limit(1))[0];
  if (!target) return 0;
  const existing = (await db.select({ id: missions.id }).from(missions)).map((m) => m.id);
  const orphans = await db
    .select({ id: missionRegistrations.id })
    .from(missionRegistrations)
    .where(notInArray(missionRegistrations.missionId, existing));
  if (orphans.length === 0) return 0;
  const ids = orphans.map((o) => o.id);
  const now = new Date().toISOString();
  await db.update(missionRegistrations).set({ missionId: target.id, updatedAt: now }).where(inArray(missionRegistrations.id, ids));
  await db.update(termsAcceptances).set({ missionId: target.id }).where(inArray(termsAcceptances.registrationId, ids));
  await log("mission", target.id, "inscripciones_revinculadas", `${ids.length} inscripciones sin misión válida vinculadas a ${target.name}`, actor);
  return ids.length;
}
