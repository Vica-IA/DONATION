import "server-only";
import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  activityLog,
  missionRegistrations,
  missions,
  organizations,
  volunteers,
  type Mission,
  type MissionRegistration,
  type Organization,
  type Volunteer,
} from "./db/schema";
import type { RegistrationStatus } from "./catalogs";
import { nowIso } from "./format";
import type { MissionInput, RegistrationInput } from "./validation";

// ---------- Organizaciones ----------

export async function listOrganizations(): Promise<Organization[]> {
  const db = await getDb();
  return db.select().from(organizations).where(eq(organizations.active, true)).orderBy(asc(organizations.name));
}

// ---------- Misiones ----------

export async function listMissions(): Promise<Mission[]> {
  const db = await getDb();
  return db.select().from(missions).orderBy(desc(missions.startDate));
}

export async function getMissionBySlug(slug: string): Promise<Mission | null> {
  const db = await getDb();
  const rows = await db.select().from(missions).where(eq(missions.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getMissionById(id: string): Promise<Mission | null> {
  const db = await getDb();
  const rows = await db.select().from(missions).where(eq(missions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createMission(input: MissionInput): Promise<Mission> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(missions).values({ id, ...input });
  await log("mission", id, "creada", input.name, "admin");
  return (await getMissionById(id))!;
}

export async function updateMission(id: string, input: MissionInput): Promise<void> {
  const db = await getDb();
  await db
    .update(missions)
    .set({ ...input, updatedAt: nowIso() })
    .where(eq(missions.id, id));
  await log("mission", id, "actualizada", null, "admin");
}

// ---------- Estadísticas ----------

export type MissionStats = {
  capacity: number;
  total: number;
  byStatus: Record<RegistrationStatus, number>;
  byOrganization: { name: string; confirmed: number; total: number }[];
  byRole: { role: string; confirmed: number }[];
  byTransport: { transport: string; confirmed: number }[];
  byAvailability: { availability: string; confirmed: number }[];
  available: number;
};

const EMPTY_STATUS: Record<RegistrationStatus, number> = {
  confirmado: 0,
  lista_espera: 0,
  pendiente: 0,
  cancelado: 0,
};

export async function getMissionStats(mission: Mission): Promise<MissionStats> {
  const db = await getDb();
  const mid = mission.id;

  const statusRows = await db
    .select({ status: missionRegistrations.status, n: count() })
    .from(missionRegistrations)
    .where(eq(missionRegistrations.missionId, mid))
    .groupBy(missionRegistrations.status);

  const byStatus = { ...EMPTY_STATUS };
  let total = 0;
  for (const r of statusRows) {
    byStatus[r.status as RegistrationStatus] = r.n;
    total += r.n;
  }

  const confirmedOnly = and(eq(missionRegistrations.missionId, mid), eq(missionRegistrations.status, "confirmado"));

  const orgRows = await db
    .select({
      name: sql<string>`coalesce(${organizations.name}, nullif(${volunteers.organizationOther}, ''), 'Sin grupo')`,
      confirmed: sql<number>`sum(case when ${missionRegistrations.status} = 'confirmado' then 1 else 0 end)`,
      total: count(),
    })
    .from(missionRegistrations)
    .innerJoin(volunteers, eq(volunteers.id, missionRegistrations.volunteerId))
    .leftJoin(organizations, eq(organizations.id, volunteers.organizationId))
    .where(eq(missionRegistrations.missionId, mid))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`);

  const roleRows = await db
    .select({
      role: sql<string>`coalesce(${missionRegistrations.assignedRole}, ${missionRegistrations.preferredRole}, 'sin_definir')`,
      confirmed: count(),
    })
    .from(missionRegistrations)
    .where(confirmedOnly)
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`);

  const transportRows = await db
    .select({ transport: missionRegistrations.transport, confirmed: count() })
    .from(missionRegistrations)
    .where(confirmedOnly)
    .groupBy(missionRegistrations.transport);

  const availabilityRows = await db
    .select({ availability: missionRegistrations.availability, confirmed: count() })
    .from(missionRegistrations)
    .where(confirmedOnly)
    .groupBy(missionRegistrations.availability);

  return {
    capacity: mission.capacity,
    total,
    byStatus,
    byOrganization: orgRows.map((r) => ({ name: r.name, confirmed: Number(r.confirmed), total: r.total })),
    byRole: roleRows,
    byTransport: transportRows,
    byAvailability: availabilityRows,
    available: Math.max(0, mission.capacity - byStatus.confirmado),
  };
}

// ---------- Inscripciones ----------

export type RegistrationRow = {
  registration: MissionRegistration;
  volunteer: Volunteer;
  organization: Organization | null;
};

export type RegistrationFilters = {
  q?: string;
  status?: string;
  organizationId?: string;
};

export async function listRegistrations(missionId: string, filters: RegistrationFilters = {}): Promise<RegistrationRow[]> {
  const db = await getDb();
  const conditions = [eq(missionRegistrations.missionId, missionId)];
  if (filters.status) conditions.push(eq(missionRegistrations.status, filters.status));
  if (filters.organizationId) conditions.push(eq(volunteers.organizationId, filters.organizationId));
  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        like(volunteers.fullName, term),
        like(volunteers.docNumber, term),
        like(volunteers.phone, term),
        like(volunteers.email, term),
      )!,
    );
  }
  const rows = await db
    .select({ registration: missionRegistrations, volunteer: volunteers, organization: organizations })
    .from(missionRegistrations)
    .innerJoin(volunteers, eq(volunteers.id, missionRegistrations.volunteerId))
    .leftJoin(organizations, eq(organizations.id, volunteers.organizationId))
    .where(and(...conditions))
    .orderBy(
      sql`case ${missionRegistrations.status} when 'confirmado' then 0 when 'lista_espera' then 1 when 'pendiente' then 2 else 3 end`,
      asc(volunteers.fullName),
    );
  return rows;
}

export type RegistrationDetail = RegistrationRow & { mission: Mission; activity: (typeof activityLog.$inferSelect)[] };

export async function getRegistration(id: string): Promise<RegistrationDetail | null> {
  const db = await getDb();
  const rows = await db
    .select({ registration: missionRegistrations, volunteer: volunteers, organization: organizations, mission: missions })
    .from(missionRegistrations)
    .innerJoin(volunteers, eq(volunteers.id, missionRegistrations.volunteerId))
    .innerJoin(missions, eq(missions.id, missionRegistrations.missionId))
    .leftJoin(organizations, eq(organizations.id, volunteers.organizationId))
    .where(eq(missionRegistrations.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const activity = await db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.entityType, "registration"), eq(activityLog.entityId, id)))
    .orderBy(desc(activityLog.createdAt))
    .limit(30);
  return { ...row, activity };
}

export type SubmitResult = {
  registrationId: string;
  status: RegistrationStatus;
  isUpdate: boolean;
};

/**
 * Registra (o actualiza) la confirmación de una persona a una misión.
 * - La persona se identifica por tipo + número de documento (sin duplicados).
 * - El estado se deriva de su respuesta y de los cupos disponibles.
 */
export async function submitRegistration(mission: Mission, input: RegistrationInput): Promise<SubmitResult> {
  const db = await getDb();
  const now = nowIso();

  const orgs = await listOrganizations();
  const organizationId = orgs.some((o) => o.id === input.organizationId) ? input.organizationId : null;

  const volunteerValues = {
    fullName: input.fullName,
    docType: input.docType,
    docNumber: input.docNumber,
    birthDate: input.birthDate,
    phone: input.phone,
    email: input.email,
    city: input.city ?? null,
    organizationId,
    organizationOther: organizationId ? null : (input.organizationOther ?? null),
    eps: input.eps ?? null,
    bloodType: input.bloodType,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
    medicalNotes: input.medicalNotes ?? null,
    dietaryNotes: input.dietaryNotes ?? null,
    shirtSize: input.shirtSize,
    skills: JSON.stringify(input.skills),
    constructionExperience: input.constructionExperience,
    dataConsent: true,
    updatedAt: now,
  };

  const existingVolunteer = (
    await db
      .select()
      .from(volunteers)
      .where(and(eq(volunteers.docType, input.docType), eq(volunteers.docNumber, input.docNumber)))
      .limit(1)
  )[0];

  let volunteerId: string;
  if (existingVolunteer) {
    volunteerId = existingVolunteer.id;
    await db.update(volunteers).set(volunteerValues).where(eq(volunteers.id, volunteerId));
  } else {
    volunteerId = crypto.randomUUID();
    await db.insert(volunteers).values({ id: volunteerId, ...volunteerValues });
  }

  const existingRegistration = (
    await db
      .select()
      .from(missionRegistrations)
      .where(and(eq(missionRegistrations.missionId, mission.id), eq(missionRegistrations.volunteerId, volunteerId)))
      .limit(1)
  )[0];

  const status = await deriveStatus(mission, input.attendance, existingRegistration);

  const registrationValues = {
    attendance: input.attendance,
    availability: input.availability,
    availabilityNotes: input.availabilityNotes ?? null,
    transport: input.transport,
    preferredRole: input.preferredRole,
    comments: input.comments ?? null,
    status,
    confirmedAt: status === "confirmado" ? (existingRegistration?.confirmedAt ?? now) : null,
    updatedAt: now,
  };

  let registrationId: string;
  if (existingRegistration) {
    registrationId = existingRegistration.id;
    await db.update(missionRegistrations).set(registrationValues).where(eq(missionRegistrations.id, registrationId));
    await log(
      "registration",
      registrationId,
      "actualizada_por_persona",
      `Respuesta: ${input.attendance}. Estado: ${existingRegistration.status} → ${status}`,
      "publico",
    );
  } else {
    registrationId = crypto.randomUUID();
    await db.insert(missionRegistrations).values({
      id: registrationId,
      missionId: mission.id,
      volunteerId,
      ...registrationValues,
    });
    await log("registration", registrationId, "creada", `Respuesta: ${input.attendance}. Estado: ${status}`, "publico");
  }

  return { registrationId, status, isUpdate: Boolean(existingRegistration) };
}

async function deriveStatus(
  mission: Mission,
  attendance: RegistrationInput["attendance"],
  existing: MissionRegistration | undefined,
): Promise<RegistrationStatus> {
  if (attendance === "no_puedo") return "cancelado";
  if (attendance === "no_seguro") return "pendiente";
  // Ya tenía cupo confirmado: lo conserva.
  if (existing?.status === "confirmado") return "confirmado";
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(missionRegistrations)
    .where(and(eq(missionRegistrations.missionId, mission.id), eq(missionRegistrations.status, "confirmado")));
  return n < mission.capacity ? "confirmado" : "lista_espera";
}

export type AdminRegistrationUpdate = {
  status: RegistrationStatus;
  assignedRole: string | null;
  adminNotes: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  organizationId: string;
};

export async function updateRegistrationByAdmin(id: string, input: AdminRegistrationUpdate): Promise<void> {
  const db = await getDb();
  const current = await getRegistration(id);
  if (!current) throw new Error("Inscripción no encontrada");
  const now = nowIso();
  const orgs = await listOrganizations();
  const organizationId = orgs.some((o) => o.id === input.organizationId) ? input.organizationId : null;

  await db
    .update(missionRegistrations)
    .set({
      status: input.status,
      assignedRole: input.assignedRole,
      adminNotes: input.adminNotes,
      confirmedAt: input.status === "confirmado" ? (current.registration.confirmedAt ?? now) : current.registration.confirmedAt,
      updatedAt: now,
    })
    .where(eq(missionRegistrations.id, id));

  await db
    .update(volunteers)
    .set({ fullName: input.fullName, phone: input.phone, email: input.email, organizationId, updatedAt: now })
    .where(eq(volunteers.id, current.volunteer.id));

  const changes: string[] = [];
  if (current.registration.status !== input.status) changes.push(`estado ${current.registration.status} → ${input.status}`);
  if ((current.registration.assignedRole ?? null) !== input.assignedRole) changes.push(`rol asignado: ${input.assignedRole ?? "—"}`);
  await log("registration", id, "actualizada_por_admin", changes.join("; ") || "datos editados", "admin");
}

// ---------- Bitácora ----------

export async function log(entityType: string, entityId: string, action: string, detail: string | null, actor: string) {
  const db = await getDb();
  await db.insert(activityLog).values({ id: crypto.randomUUID(), entityType, entityId, action, detail, actor });
}

export async function recentActivity(limit = 12) {
  const db = await getDb();
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}
