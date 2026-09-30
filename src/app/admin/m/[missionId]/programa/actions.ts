"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { can } from "@/lib/permissions";
import { createItineraryItem, deleteItineraryItem, getItineraryItem, updateItineraryItem } from "@/lib/program";
import { flattenErrors, formToObject, itinerarySchema, type FieldErrors } from "@/lib/validation";

export type ItemFormState = { errors: FieldErrors; values: Record<string, unknown>; saved?: boolean };

function revalidate(missionId: string, slug: string) {
  revalidatePath(`/admin/m/${missionId}`, "layout");
  revalidatePath(`/misiones/${slug}`);
}

export async function createItemAction(missionId: string, _prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const user = await requireUser(`/admin/m/${missionId}/programa`);
  if (!can(user.role, "program.manage")) return { errors: { _form: "No tienes permiso para editar el programa." }, values: {} };
  const mission = await getMissionById(missionId);
  if (!mission) return { errors: { _form: "La misión no existe." }, values: {} };
  const raw = formToObject(formData);
  const parsed = itinerarySchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  await createItineraryItem(missionId, parsed.data, user.name);
  revalidate(missionId, mission.slug);
  return { errors: {}, values: {}, saved: true };
}

export async function updateItemAction(missionId: string, itemId: string, _prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const user = await requireUser(`/admin/m/${missionId}/programa/${itemId}`);
  if (!can(user.role, "program.manage")) return { errors: { _form: "No tienes permiso para editar el programa." }, values: {} };
  const [mission, item] = await Promise.all([getMissionById(missionId), getItineraryItem(itemId)]);
  if (!mission || !item || item.missionId !== missionId) return { errors: { _form: "La actividad no existe." }, values: {} };
  const raw = formToObject(formData);
  const parsed = itinerarySchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  await updateItineraryItem(itemId, parsed.data, user.name);
  revalidate(missionId, mission.slug);
  return { errors: {}, values: {}, saved: true };
}

export async function deleteItemAction(missionId: string, itemId: string): Promise<void> {
  const user = await requireUser(`/admin/m/${missionId}/programa/${itemId}`);
  const [mission, item] = await Promise.all([getMissionById(missionId), getItineraryItem(itemId)]);
  if (!mission || !item || item.missionId !== missionId || !can(user.role, "program.manage")) redirect(`/admin/m/${missionId}?denegado=1`);
  await deleteItineraryItem(itemId, user.name);
  revalidate(missionId, mission.slug);
  redirect(`/admin/m/${missionId}/programa?dia=${item.day}`);
}
