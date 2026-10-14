"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { can } from "@/lib/permissions";
import { createItineraryItem, createPlace, deleteItineraryItem, deletePlace, duplicateItineraryItem, getItineraryItem, getPlace, updateItineraryItem } from "@/lib/program";
import { flattenErrors, formToObject, itinerarySchema, placeSchema, type FieldErrors } from "@/lib/validation";

export type EditorState = { errors: FieldErrors; values: Record<string, unknown> };

const NO_PERMISSION: EditorState = { errors: { _form: "No tienes permiso para editar el programa." }, values: {} };
/** Parámetros que abren el editor o el modal de lugares, o muestran un mensaje; se quitan al terminar. */
const MODAL_PARAMS = ["editar", "lugares", "msg", "avisar"];

function programPath(missionId: string) {
  return `/admin/m/${missionId}/programa`;
}

function revalidate(missionId: string, slug: string) {
  revalidatePath(`/admin/m/${missionId}`, "layout");
  revalidatePath(`/misiones/${slug}`);
}

/** Vuelve al programa conservando día y filtro de área, cierra el editor y muestra un mensaje. */
function finish(missionId: string, slug: string, returnTo: unknown, msg: string, extra: Record<string, string> = {}, keep: string[] = []): never {
  revalidate(missionId, slug);
  const base = typeof returnTo === "string" && returnTo.startsWith(programPath(missionId)) ? returnTo : programPath(missionId);
  const url = new URL(base, "http://local");
  for (const p of MODAL_PARAMS) if (!keep.includes(p)) url.searchParams.delete(p);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  url.searchParams.set("msg", msg);
  redirect(`${url.pathname}${url.search}`);
}

async function manager(missionId: string) {
  const user = await requireUser(programPath(missionId));
  const mission = await getMissionById(missionId);
  return { user, mission, allowed: Boolean(mission) && can(user.role, "program.manage") };
}

// ---------- Editor lateral (useActionState) ----------

/** Crea (itemId vacío) o actualiza una actividad. Al guardar vuelve al día de la actividad. */
export async function saveItemAction(missionId: string, itemId: string, _prev: EditorState, formData: FormData): Promise<EditorState> {
  const { user, mission, allowed } = await manager(missionId);
  if (!mission || !allowed) return NO_PERMISSION;
  const raw = formToObject(formData, ["teams"]);
  const parsed = itinerarySchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  let id = itemId;
  if (itemId) {
    const item = await getItineraryItem(itemId);
    if (!item || item.missionId !== mission.id) return { errors: { _form: "La actividad ya no existe." }, values: raw };
    await updateItineraryItem(itemId, parsed.data, user.name);
  } else {
    id = (await createItineraryItem(mission.id, parsed.data, user.name)).id;
  }
  const extra: Record<string, string> = { dia: parsed.data.day };
  if (parsed.data.notify) extra.avisar = id;
  finish(mission.id, mission.slug, raw.returnTo, itemId ? "Cambios guardados." : "Actividad creada.", extra);
}

export async function deleteItemAction(missionId: string, itemId: string, formData: FormData): Promise<void> {
  const { user, mission, allowed } = await manager(missionId);
  const item = await getItineraryItem(itemId);
  if (!mission || !allowed || !item || item.missionId !== mission.id) redirect(`/admin/m/${missionId}?denegado=1`);
  await deleteItineraryItem(itemId, user.name);
  finish(mission.id, mission.slug, formData.get("returnTo"), "Actividad eliminada.", { dia: item.day });
}

/** Duplica la actividad y abre la copia en el editor. */
export async function duplicateItemAction(missionId: string, itemId: string, formData: FormData): Promise<void> {
  const { user, mission, allowed } = await manager(missionId);
  const item = await getItineraryItem(itemId);
  if (!mission || !allowed || !item || item.missionId !== mission.id) redirect(`/admin/m/${missionId}?denegado=1`);
  const copy = await duplicateItineraryItem(itemId, user.name);
  finish(mission.id, mission.slug, formData.get("returnTo"), "Actividad duplicada: ajusta la copia.", { dia: item.day, editar: copy?.id ?? "" }, ["editar"]);
}

// ---------- Lugares ----------

export async function createPlaceAction(missionId: string, _prev: EditorState, formData: FormData): Promise<EditorState> {
  const { user, mission, allowed } = await manager(missionId);
  if (!mission || !allowed) return NO_PERMISSION;
  const raw = formToObject(formData);
  const parsed = placeSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  const place = await createPlace(mission.id, parsed.data, user.name);
  finish(mission.id, mission.slug, raw.returnTo, `Lugar agregado: ${place.name}.`, {}, ["lugares", "editar"]);
}

export async function deletePlaceAction(missionId: string, placeId: string, formData: FormData): Promise<void> {
  const { user, mission, allowed } = await manager(missionId);
  const place = await getPlace(placeId);
  if (!mission || !allowed || !place || place.missionId !== mission.id) redirect(`/admin/m/${missionId}?denegado=1`);
  const removed = await deletePlace(placeId, user.name);
  finish(mission.id, mission.slug, formData.get("returnTo"), removed ? `Lugar quitado: ${place.name}.` : `${place.name} está en uso en el programa.`, {}, ["lugares", "editar"]);
}
