import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { log } from "./data";
import { getDb } from "./db";
import { announcements, itineraryItems, missionRegistrations, organizations, squads, volunteers, type Announcement, type ItineraryItem, type Squad } from "./db/schema";
import { nowIso } from "./format";
import { addDays } from "./mission-timeline";
import type { AnnouncementInput, ItineraryInput, SquadInput } from "./validation";

// ---------- Programa ----------

export async function listItinerary(missionId: string): Promise<ItineraryItem[]> {
  const db = await getDb();
  return db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.missionId, missionId))
    .orderBy(asc(itineraryItems.day), asc(itineraryItems.startTime), asc(itineraryItems.title));
}

export async function getItineraryItem(id: string): Promise<ItineraryItem | null> {
  const db = await getDb();
  return (await db.select().from(itineraryItems).where(eq(itineraryItems.id, id)).limit(1))[0] ?? null;
}

export async function createItineraryItem(missionId: string, input: ItineraryInput, actor: string): Promise<ItineraryItem> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(itineraryItems).values({ id, missionId, ...input, createdBy: actor });
  await log("program", id, "actividad_creada", `${input.day} ${input.startTime} · ${input.title}`, actor);
  return (await getItineraryItem(id))!;
}

export async function updateItineraryItem(id: string, input: ItineraryInput, actor: string): Promise<void> {
  const db = await getDb();
  await db
    .update(itineraryItems)
    .set({ ...input, updatedAt: nowIso() })
    .where(eq(itineraryItems.id, id));
  await log("program", id, "actividad_actualizada", `${input.day} ${input.startTime} · ${input.title}`, actor);
}

export async function deleteItineraryItem(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const current = await getItineraryItem(id);
  if (!current) return;
  await db.delete(itineraryItems).where(eq(itineraryItems.id, id));
  await log("program", id, "actividad_eliminada", `${current.day} ${current.startTime} · ${current.title}`, actor);
}

// ---------- Avisos ----------

export async function listAnnouncements(missionId: string): Promise<Announcement[]> {
  const db = await getDb();
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.missionId, missionId))
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt));
}

export async function getAnnouncement(id: string): Promise<Announcement | null> {
  const db = await getDb();
  return (await db.select().from(announcements).where(eq(announcements.id, id)).limit(1))[0] ?? null;
}

export async function createAnnouncement(missionId: string, input: AnnouncementInput, actor: string): Promise<Announcement> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(announcements).values({ id, missionId, ...input, createdBy: actor });
  await log("announcement", id, "aviso_publicado", input.title, actor);
  return (await getAnnouncement(id))!;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput, actor: string): Promise<void> {
  const db = await getDb();
  await db
    .update(announcements)
    .set({ ...input, updatedAt: nowIso() })
    .where(eq(announcements.id, id));
  await log("announcement", id, "aviso_actualizado", input.title, actor);
}

export async function deleteAnnouncement(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const current = await getAnnouncement(id);
  if (!current) return;
  await db.delete(announcements).where(eq(announcements.id, id));
  await log("announcement", id, "aviso_eliminado", current.title, actor);
}

// ---------- Cuadrillas ----------

export type SquadMember = {
  registrationId: string;
  fullName: string;
  phone: string;
  organizationName: string | null;
  refugio: string | null;
  role: string | null;
};

export type SquadWithMembers = Squad & { members: SquadMember[]; leader: SquadMember | null };

type Db = Awaited<ReturnType<typeof getDb>>;

async function membersByMission(db: Db, missionId: string): Promise<Map<string, SquadMember[]>> {
  const rows = await db
    .select({
      squadId: missionRegistrations.squadId,
      registrationId: missionRegistrations.id,
      fullName: volunteers.fullName,
      phone: volunteers.phone,
      organizationName: organizations.name,
      refugio: volunteers.refugio,
      assignedRole: missionRegistrations.assignedRole,
      preferredRole: missionRegistrations.preferredRole,
    })
    .from(missionRegistrations)
    .innerJoin(volunteers, eq(volunteers.id, missionRegistrations.volunteerId))
    .leftJoin(organizations, eq(organizations.id, volunteers.organizationId))
    .where(and(eq(missionRegistrations.missionId, missionId), isNotNull(missionRegistrations.squadId)))
    .orderBy(asc(volunteers.fullName));
  const map = new Map<string, SquadMember[]>();
  for (const r of rows) {
    if (!r.squadId) continue;
    const list = map.get(r.squadId) ?? [];
    list.push({
      registrationId: r.registrationId,
      fullName: r.fullName,
      phone: r.phone,
      organizationName: r.organizationName ?? null,
      refugio: r.refugio ?? null,
      role: r.assignedRole ?? r.preferredRole ?? null,
    });
    map.set(r.squadId, list);
  }
  return map;
}

function withMembers(s: Squad, members: Map<string, SquadMember[]>): SquadWithMembers {
  const list = members.get(s.id) ?? [];
  return { ...s, members: list, leader: list.find((m) => m.registrationId === s.leaderRegistrationId) ?? null };
}

export async function listSquads(missionId: string): Promise<SquadWithMembers[]> {
  const db = await getDb();
  const list = await db.select().from(squads).where(eq(squads.missionId, missionId)).orderBy(asc(squads.name));
  const members = await membersByMission(db, missionId);
  return list.map((s) => withMembers(s, members));
}

export async function getSquad(id: string): Promise<SquadWithMembers | null> {
  const db = await getDb();
  const s = (await db.select().from(squads).where(eq(squads.id, id)).limit(1))[0];
  if (!s) return null;
  return withMembers(s, await membersByMission(db, s.missionId));
}

function squadValues(input: SquadInput) {
  return {
    name: input.name,
    area: input.area,
    leaderRegistrationId: input.leaderRegistrationId || null,
    meetingPoint: input.meetingPoint,
    notes: input.notes,
  };
}

export async function createSquad(missionId: string, input: SquadInput, actor: string): Promise<Squad> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(squads).values({ id, missionId, ...squadValues(input), createdBy: actor });
  await log("squad", id, "cuadrilla_creada", input.name, actor);
  return (await db.select().from(squads).where(eq(squads.id, id)).limit(1))[0];
}

export async function updateSquad(id: string, input: SquadInput, actor: string): Promise<void> {
  const db = await getDb();
  await db
    .update(squads)
    .set({ ...squadValues(input), updatedAt: nowIso() })
    .where(eq(squads.id, id));
  await log("squad", id, "cuadrilla_actualizada", input.name, actor);
}

export async function deleteSquad(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const current = (await db.select().from(squads).where(eq(squads.id, id)).limit(1))[0];
  if (!current) return;
  await db.update(missionRegistrations).set({ squadId: null }).where(eq(missionRegistrations.squadId, id));
  await db.delete(squads).where(eq(squads.id, id));
  await log("squad", id, "cuadrilla_eliminada", current.name, actor);
}

/** Fija los integrantes (solo inscripciones confirmadas de la misión). Quien sale deja de ser líder. */
export async function setSquadMembers(squad: Squad, registrationIds: string[], actor: string): Promise<void> {
  const db = await getDb();
  const ids = [...new Set(registrationIds)];
  const removeWhere = ids.length
    ? and(eq(missionRegistrations.squadId, squad.id), notInArray(missionRegistrations.id, ids))
    : eq(missionRegistrations.squadId, squad.id);
  await db.update(missionRegistrations).set({ squadId: null }).where(removeWhere);
  if (ids.length) {
    await db
      .update(missionRegistrations)
      .set({ squadId: squad.id })
      .where(and(eq(missionRegistrations.missionId, squad.missionId), eq(missionRegistrations.status, "confirmado"), inArray(missionRegistrations.id, ids)));
  }
  if (squad.leaderRegistrationId && !ids.includes(squad.leaderRegistrationId)) {
    await db.update(squads).set({ leaderRegistrationId: null, updatedAt: nowIso() }).where(eq(squads.id, squad.id));
  }
  await log("squad", squad.id, "integrantes_actualizados", `${squad.name}: ${ids.length} integrantes`, actor);
}

// ---------- Cálculos puros ----------

/** Días de la misión, del primero al último. */
export function missionDays(mission: { startDate: string; endDate: string }): string[] {
  const days: string[] = [];
  let d = mission.startDate;
  while (d <= mission.endDate && days.length < 31) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Actividad en curso (sin hora fin: 90 minutos) y la siguiente, a partir de la fecha y hora actuales. */
export function currentAndNext(items: ItineraryItem[], today: string, nowTime: string): { current: ItineraryItem | null; next: ItineraryItem | null } {
  let current: ItineraryItem | null = null;
  let next: ItineraryItem | null = null;
  for (const it of items) {
    if (it.day < today) continue;
    if (it.day === today) {
      const end = it.endTime ?? addMinutes(it.startTime, 90);
      if (it.startTime <= nowTime && end > nowTime) {
        current = it;
        continue;
      }
      if (it.startTime > nowTime && !next) next = it;
    } else if (!next) {
      next = it;
    }
  }
  return { current, next };
}
