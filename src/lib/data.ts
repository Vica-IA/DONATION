import "server-only";
import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  activityLog,
  missionRegistrations,
  missions,
  organizations,
  termsAcceptances,
  volunteers,
  type Mission,
  type MissionRegistration,
  type Organization,
  type TermsAcceptance,
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

/** Misión "activa" para el panel: la próxima con inscripciones abiertas, o la más reciente. */
export async function getActiveMission(): Promise<Mission | null> {
  const all = await listMissions();
  if (all.length === 0) return null;
  const open = all.filter((m) => m.registrationOpen).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return open[0] ?? all[0];
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

export async function createMission(input: MissionInput, actor: string): Promise<Mission> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(missions).values({ id, ...input });
  await log("mission", id, "creada", input.name, actor);
  return (await getMissionById(id))!;
}

export async function updateMission(id: string, input: MissionInput, actor: string): Promise<void> {
  const db = await getDb();
  await db
    .update(missions)
    .set({ ...input, updatedAt: nowIso() })
    .where(eq(missions.id, id));
  await log("mission", id, "actualizada", null, actor);
}

// ---------- Estadísticas ----------

export type MissionStats = {
  capacity: number;
  total: number;
  /** Confirmados que aceptaron la versión vigente de las condiciones. */
  termsAccepted: number;
  /** Confirmados con aporte pagado o exento. */
  paid: number;
  byStatus: Record<RegistrationStatus, number>;
  byOrganization: { name: string; confirmed: number; total: number }[];
  byRole: { role: string; confirmed: number }[];
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

  const [{ n: termsAccepted }] = await db
    .select({ n: count() })
    .from(missionRegistrations)
    .where(
      and(
        confirmedOnly,
        sql`exists (select 1 from ${termsAcceptances} where ${termsAcceptances.registrationId} = ${missionRegistrations.id} and ${termsAcceptances.termsVersion} = ${mission.termsVersion})`,
      ),
    );

  const [{ n: paid }] = await db
    .select({ n: count() })
    .from(missionRegistrations)
    .where(and(confirmedOnly, inArray(missionRegistrations.paymentStatus, ["pagado", "exento"])));

  return {
    capacity: mission.capacity,
    total,
    termsAccepted,
    paid,
    byStatus,
    byOrganization: orgRows.map((r) => ({ name: r.name, confirmed: Number(r.confirmed), total: r.total })),
    byRole: roleRows,
    available: Math.max(0, mission.capacity - byStatus.confirmado),
  };
}

// ---------- Inscripciones ----------

export type RegistrationRow = {
  registration: MissionRegistration;
  volunteer: Volunteer;
  organization: Organization | null;
  /** Fecha de aceptación de la versión vigente de las condiciones, o null. */
  termsAcceptedAt: string | null;
  imageConsent: boolean | null;
};

export type RegistrationFilters = {
  q?: string;
  status?: string;
  organizationId?: string;
  /** 'condiciones' = sin aceptar condiciones; 'aporte' = aporte pendiente o parcial. */
  requisito?: string;
};

export async function listRegistrations(mission: Mission, filters: RegistrationFilters = {}): Promise<RegistrationRow[]> {
  const db = await getDb();
  const missionId = mission.id;
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

  const acceptances = await db
    .select({
      registrationId: termsAcceptances.registrationId,
      acceptedAt: termsAcceptances.acceptedAt,
      imageConsent: termsAcceptances.imageConsent,
    })
    .from(termsAcceptances)
    .where(and(eq(termsAcceptances.missionId, missionId), eq(termsAcceptances.termsVersion, mission.termsVersion)));
  const byRegistration = new Map(acceptances.map((a) => [a.registrationId, a]));

  const result: RegistrationRow[] = rows.map((row) => {
    const a = byRegistration.get(row.registration.id);
    return { ...row, termsAcceptedAt: a?.acceptedAt ?? null, imageConsent: a?.imageConsent ?? null };
  });

  if (filters.requisito === "condiciones") return result.filter((r) => !r.termsAcceptedAt);
  if (filters.requisito === "aporte") return result.filter((r) => r.registration.paymentStatus === "pendiente" || r.registration.paymentStatus === "parcial");
  return result;
}

export type RegistrationDetail = RegistrationRow & {
  mission: Mission;
  activity: (typeof activityLog.$inferSelect)[];
  /** Aceptación de la versión vigente, si existe. */
  termsAcceptance: TermsAcceptance | null;
  /** Historial completo de aceptaciones (todas las versiones). */
  acceptances: TermsAcceptance[];
};

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
  const acceptances = await db
    .select()
    .from(termsAcceptances)
    .where(eq(termsAcceptances.registrationId, id))
    .orderBy(desc(termsAcceptances.acceptedAt));
  const termsAcceptance = acceptances.find((a) => a.termsVersion === row.mission.termsVersion) ?? null;
  return {
    ...row,
    activity,
    acceptances,
    termsAcceptance,
    termsAcceptedAt: termsAcceptance?.acceptedAt ?? null,
    imageConsent: termsAcceptance?.imageConsent ?? null,
  };
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
    organizationOther: null,
    refugio: input.refugio ?? null,
    eps: input.eps ?? null,
    bloodType: input.bloodType,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
    emergencyContactRelationship: input.emergencyContactRelationship ?? null,
    emergencyContactPhone2: input.emergencyContactPhone2 ?? null,
    accidentInsurance: input.accidentInsurance ?? null,
    medicalNotes: input.medicalNotes ?? null,
    dietaryNotes: input.dietaryNotes ?? null,
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
    // Disponibilidad y transporte ya no se preguntan en el formulario: quedan vacíos.
    availability: "",
    availabilityNotes: null,
    transport: "",
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
  paymentStatus: string;
  paymentAmount: number | null;
  paymentNotes: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  organizationId: string;
  refugio: string | null;
};

export async function updateRegistrationByAdmin(id: string, input: AdminRegistrationUpdate, actor: string): Promise<void> {
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
      paymentStatus: input.paymentStatus,
      paymentAmount: input.paymentAmount,
      paymentNotes: input.paymentNotes,
      confirmedAt: input.status === "confirmado" ? (current.registration.confirmedAt ?? now) : current.registration.confirmedAt,
      updatedAt: now,
    })
    .where(eq(missionRegistrations.id, id));

  await db
    .update(volunteers)
    .set({ fullName: input.fullName, phone: input.phone, email: input.email, organizationId, refugio: input.refugio, updatedAt: now })
    .where(eq(volunteers.id, current.volunteer.id));

  const changes: string[] = [];
  if (current.registration.status !== input.status) changes.push(`estado ${current.registration.status} → ${input.status}`);
  if ((current.registration.assignedRole ?? null) !== input.assignedRole) changes.push(`rol asignado: ${input.assignedRole ?? "—"}`);
  if (current.registration.paymentStatus !== input.paymentStatus) changes.push(`aporte ${current.registration.paymentStatus} → ${input.paymentStatus}`);
  if ((current.registration.paymentAmount ?? null) !== input.paymentAmount) changes.push(`valor del aporte ${current.registration.paymentAmount ?? "—"} → ${input.paymentAmount ?? "—"}`);
  await log("registration", id, "actualizada_por_admin", changes.join("; ") || "datos editados", actor);
}

/** Confirmados cuyo rol (asignado o preferido) pertenece al área. */
export async function listVolunteersForArea(mission: Mission, roles: readonly string[]): Promise<RegistrationRow[]> {
  if (roles.length === 0) return [];
  const rows = await listRegistrations(mission, { status: "confirmado" });
  return rows.filter((r) => roles.includes(r.registration.assignedRole ?? r.registration.preferredRole ?? ""));
}

// ---------- Condiciones de participación ----------

export function missionHasTerms(mission: Mission): boolean {
  return Boolean(mission.termsMarkdown && mission.termsMarkdown.trim());
}

export function termsDeclarationList(mission: Mission): string[] {
  return mission.termsDeclarations
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Huella del texto aceptado, para dejar evidencia de qué versión exacta se aceptó. */
export function termsDocumentHash(mission: Mission): string {
  return createHash("sha256")
    .update(`v${mission.termsVersion}\n${mission.termsMarkdown ?? ""}\n${mission.termsDeclarations}`)
    .digest("hex");
}

export type TermsContext = { mission: Mission; registration: MissionRegistration; volunteer: Volunteer; acceptance: TermsAcceptance | null };

/** Contexto de la página pública de condiciones: la inscripción debe pertenecer a la misión del slug. */
export async function getTermsContext(slug: string, registrationId: string): Promise<TermsContext | null> {
  const db = await getDb();
  const mission = await getMissionBySlug(slug);
  if (!mission) return null;
  const row = (
    await db
      .select({ registration: missionRegistrations, volunteer: volunteers })
      .from(missionRegistrations)
      .innerJoin(volunteers, eq(volunteers.id, missionRegistrations.volunteerId))
      .where(and(eq(missionRegistrations.id, registrationId), eq(missionRegistrations.missionId, mission.id)))
      .limit(1)
  )[0];
  if (!row) return null;
  const acceptance =
    (
      await db
        .select()
        .from(termsAcceptances)
        .where(and(eq(termsAcceptances.registrationId, registrationId), eq(termsAcceptances.termsVersion, mission.termsVersion)))
        .orderBy(desc(termsAcceptances.acceptedAt))
        .limit(1)
    )[0] ?? null;
  return { mission, registration: row.registration, volunteer: row.volunteer, acceptance };
}

export async function recordTermsAcceptance(
  ctx: TermsContext,
  input: { declarations: string[]; imageConsent: boolean | null; signedName: string; signedCity: string; userAgent: string | null },
): Promise<TermsAcceptance> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(termsAcceptances).values({
    id,
    missionId: ctx.mission.id,
    registrationId: ctx.registration.id,
    volunteerId: ctx.volunteer.id,
    termsVersion: ctx.mission.termsVersion,
    documentHash: termsDocumentHash(ctx.mission),
    declarations: JSON.stringify(input.declarations),
    imageConsent: input.imageConsent,
    signedName: input.signedName,
    signedDocNumber: ctx.volunteer.docNumber,
    signedCity: input.signedCity,
    userAgent: input.userAgent,
  });
  await log(
    "registration",
    ctx.registration.id,
    "condiciones_aceptadas",
    `versión ${ctx.mission.termsVersion}${input.imageConsent === null ? "" : input.imageConsent ? " · autoriza imagen" : " · no autoriza imagen"}`,
    "publico",
  );
  return (await db.select().from(termsAcceptances).where(eq(termsAcceptances.id, id)).limit(1))[0];
}

/**
 * Borra una inscripción con sus aceptaciones de condiciones. Si la persona no
 * tiene otras inscripciones, también se borran sus datos personales (no queda
 * información de alguien que ya no participa). La bitácora conserva el rastro.
 */
export async function deleteRegistration(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const detail = await getRegistration(id);
  if (!detail) return;
  const { registration: r, volunteer: v } = detail;
  await db.delete(termsAcceptances).where(eq(termsAcceptances.registrationId, id));
  await db.delete(missionRegistrations).where(eq(missionRegistrations.id, id));
  const [{ n: others }] = await db.select({ n: count() }).from(missionRegistrations).where(eq(missionRegistrations.volunteerId, v.id));
  let detailText = `${v.fullName} · ${v.docType} ${v.docNumber} · estado ${r.status}`;
  if (others === 0) {
    await db.delete(volunteers).where(eq(volunteers.id, v.id));
    detailText += " · datos personales borrados";
  }
  await log("registration", id, "eliminada", detailText, actor);
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
