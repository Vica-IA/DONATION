"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isArea, type TaskStatus } from "@/lib/catalogs";
import { getMissionById } from "@/lib/data";
import { canEditTask, taskAreasFor } from "@/lib/permissions";
import { createTask, deleteTask, getTask, nextStatus, setTaskStatus, updateTask } from "@/lib/tasks";
import { flattenErrors, formToObject, taskSchema, type FieldErrors } from "@/lib/validation";

export type TaskFormState = { errors: FieldErrors; values: Record<string, unknown>; saved?: boolean };

function revalidateMission(missionId: string) {
  revalidatePath(`/admin/m/${missionId}`, "layout");
}

function allowedArea(actor: Awaited<ReturnType<typeof requireUser>>, area: string): boolean {
  const areas = taskAreasFor(actor);
  if (areas === null) return false;
  if (areas === "all") return true;
  return isArea(area) && areas.includes(area);
}

export async function createTaskAction(missionId: string, _prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const user = await requireUser(`/admin/m/${missionId}/tareas`);
  const mission = await getMissionById(missionId);
  if (!mission) return { errors: { _form: "La misión no existe." }, values: {} };
  const raw = formToObject(formData, [], ["isGoCriteria"]);
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  if (!allowedArea(user, parsed.data.area)) return { errors: { _form: "No puedes crear tareas en esa área." }, values: raw };
  // Un líder o coordinador queda como responsable si no eligió a nadie.
  const input = { ...parsed.data, ownerUserId: parsed.data.ownerUserId || (user.role === "admin" ? "" : user.id) };
  await createTask(missionId, input, user.name);
  revalidateMission(missionId);
  return { errors: {}, values: {}, saved: true };
}

export async function updateTaskAction(missionId: string, taskId: string, _prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const user = await requireUser(`/admin/m/${missionId}/tareas/${taskId}`);
  const task = await getTask(taskId);
  if (!task || task.missionId !== missionId) return { errors: { _form: "La tarea no existe." }, values: {} };
  if (!canEditTask(user, task)) return { errors: { _form: "No tienes permiso para editar esta tarea." }, values: {} };
  const raw = formToObject(formData, [], ["isGoCriteria"]);
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  if (parsed.data.area !== task.area && !allowedArea(user, parsed.data.area)) {
    return { errors: { area: "No puedes mover la tarea a esa área." }, values: raw };
  }
  await updateTask(taskId, parsed.data, user.name);
  revalidateMission(missionId);
  return { errors: {}, values: {}, saved: true };
}

/** Avanza pendiente → en curso → hecha → pendiente (tablero). */
export async function advanceTaskAction(missionId: string, taskId: string): Promise<void> {
  const user = await requireUser(`/admin/m/${missionId}/tareas`);
  const task = await getTask(taskId);
  if (!task || task.missionId !== missionId || !canEditTask(user, task)) redirect(`/admin/m/${missionId}?denegado=1`);
  await setTaskStatus(taskId, nextStatus(task.status), user.name);
  revalidateMission(missionId);
}

/** Alterna hecha ↔ pendiente (casillas de Go / No-Go y listas de área). */
export async function toggleTaskAction(missionId: string, taskId: string): Promise<void> {
  const user = await requireUser(`/admin/m/${missionId}`);
  const task = await getTask(taskId);
  if (!task || task.missionId !== missionId || !canEditTask(user, task)) redirect(`/admin/m/${missionId}?denegado=1`);
  const status: TaskStatus = task.status === "hecha" ? "pendiente" : "hecha";
  await setTaskStatus(taskId, status, user.name);
  revalidateMission(missionId);
}

export async function deleteTaskAction(missionId: string, taskId: string): Promise<void> {
  const user = await requireUser(`/admin/m/${missionId}/tareas/${taskId}`);
  const task = await getTask(taskId);
  if (!task || task.missionId !== missionId || !canEditTask(user, task)) redirect(`/admin/m/${missionId}?denegado=1`);
  await deleteTask(taskId, user.name);
  revalidateMission(missionId);
  redirect(`/admin/m/${missionId}/tareas`);
}
