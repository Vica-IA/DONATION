import "server-only";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { AREAS, GENERAL_AREA, areaInfo, type TaskStatus } from "./catalogs";
import { log } from "./data";
import { getDb } from "./db";
import { tasks, users, type Task } from "./db/schema";
import { nowIso } from "./format";
import type { TaskInput } from "./validation";

export type TaskRow = Task & { ownerName: string | null };

const STATUS_ORDER = sql`case ${tasks.status} when 'pendiente' then 0 when 'en_curso' then 1 else 2 end`;

export async function listTasks(missionId: string): Promise<TaskRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ task: tasks, ownerName: users.name })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.ownerUserId))
    .where(eq(tasks.missionId, missionId))
    .orderBy(STATUS_ORDER, sql`${tasks.dueDate} is null`, asc(tasks.dueDate), asc(tasks.title));
  return rows.map((r) => ({ ...r.task, ownerName: r.ownerName }));
}

export async function countOpenTasks(missionId: string): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(tasks)
    .where(and(eq(tasks.missionId, missionId), ne(tasks.status, "hecha")));
  return n;
}

export async function getTask(id: string): Promise<TaskRow | null> {
  const db = await getDb();
  const row = (
    await db.select({ task: tasks, ownerName: users.name }).from(tasks).leftJoin(users, eq(users.id, tasks.ownerUserId)).where(eq(tasks.id, id)).limit(1)
  )[0];
  return row ? { ...row.task, ownerName: row.ownerName } : null;
}

function values(input: TaskInput) {
  return {
    title: input.title,
    area: input.area,
    ownerUserId: input.ownerUserId || null,
    dueDate: input.dueDate,
    status: input.status,
    isGoCriteria: input.isGoCriteria,
    notes: input.notes ?? null,
  };
}

export async function createTask(missionId: string, input: TaskInput, actor: string): Promise<Task> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(tasks).values({
    id,
    missionId,
    ...values(input),
    completedAt: input.status === "hecha" ? nowIso() : null,
    createdBy: actor,
  });
  await log("task", id, "creada", `${areaInfo(input.area).short} · ${input.title}`, actor);
  return (await db.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0];
}

export async function updateTask(id: string, input: TaskInput, actor: string): Promise<void> {
  const db = await getDb();
  const current = (await db.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0];
  if (!current) throw new Error("Tarea no encontrada");
  const now = nowIso();
  await db
    .update(tasks)
    .set({
      ...values(input),
      completedAt: input.status === "hecha" ? (current.completedAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(tasks.id, id));
  await log("task", id, "actualizada", input.title, actor);
}

export async function setTaskStatus(id: string, status: TaskStatus, actor: string): Promise<void> {
  const db = await getDb();
  const current = (await db.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0];
  if (!current) throw new Error("Tarea no encontrada");
  const now = nowIso();
  await db
    .update(tasks)
    .set({ status, completedAt: status === "hecha" ? (current.completedAt ?? now) : null, updatedAt: now })
    .where(eq(tasks.id, id));
  await log("task", id, "estado", `${current.title}: ${current.status} → ${status}`, actor);
}

export async function deleteTask(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const current = (await db.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0];
  if (!current) return;
  await db.delete(tasks).where(eq(tasks.id, id));
  await log("task", id, "eliminada", current.title, actor);
}

// ---------- Cálculos puros ----------

export function nextStatus(status: string): TaskStatus {
  return status === "pendiente" ? "en_curso" : status === "en_curso" ? "hecha" : "pendiente";
}

export type AreaSummary = { area: string; total: number; done: number; next: TaskRow | null; overdue: number };

/** Resumen por área (incluye 'general' al final), en el orden del catálogo. */
export function summarizeAreas(all: TaskRow[], today: string): AreaSummary[] {
  const keys = [...AREAS.map((a) => a.value), GENERAL_AREA.value];
  return keys.map((area) => {
    const list = all.filter((t) => t.area === area);
    const open = list.filter((t) => t.status !== "hecha");
    return {
      area,
      total: list.length,
      done: list.length - open.length,
      next: open[0] ?? null,
      overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
    };
  });
}

export function goCriteria(all: TaskRow[]): { items: TaskRow[]; done: number; total: number } {
  const items = all.filter((t) => t.isGoCriteria);
  return { items, done: items.filter((t) => t.status === "hecha").length, total: items.length };
}

/** Pendientes ordenados por fecha límite (las vencidas primero). */
export function criticalPending(all: TaskRow[], limit = 6): TaskRow[] {
  return all
    .filter((t) => t.status !== "hecha")
    .slice()
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function taskProgress(all: TaskRow[]): number {
  if (all.length === 0) return 0;
  return Math.round((all.filter((t) => t.status === "hecha").length / all.length) * 100);
}
