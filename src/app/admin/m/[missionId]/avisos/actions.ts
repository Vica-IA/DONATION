"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { can } from "@/lib/permissions";
import { createAnnouncement, deleteAnnouncement, getAnnouncement, updateAnnouncement } from "@/lib/program";
import { announcementSchema, flattenErrors, formToObject, type FieldErrors } from "@/lib/validation";

export type AnnouncementFormState = { errors: FieldErrors; values: Record<string, unknown>; saved?: boolean };

function revalidate(missionId: string, slug: string) {
  revalidatePath(`/admin/m/${missionId}`, "layout");
  revalidatePath(`/misiones/${slug}`);
}

export async function createAnnouncementAction(missionId: string, _prev: AnnouncementFormState, formData: FormData): Promise<AnnouncementFormState> {
  const user = await requireUser(`/admin/m/${missionId}/avisos`);
  if (!can(user.role, "program.manage")) return { errors: { _form: "No tienes permiso para publicar avisos." }, values: {} };
  const mission = await getMissionById(missionId);
  if (!mission) return { errors: { _form: "La misión no existe." }, values: {} };
  const raw = formToObject(formData, [], ["pinned"]);
  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  await createAnnouncement(missionId, parsed.data, user.name);
  revalidate(missionId, mission.slug);
  return { errors: {}, values: {}, saved: true };
}

export async function updateAnnouncementAction(missionId: string, id: string, _prev: AnnouncementFormState, formData: FormData): Promise<AnnouncementFormState> {
  const user = await requireUser(`/admin/m/${missionId}/avisos/${id}`);
  if (!can(user.role, "program.manage")) return { errors: { _form: "No tienes permiso para editar avisos." }, values: {} };
  const [mission, current] = await Promise.all([getMissionById(missionId), getAnnouncement(id)]);
  if (!mission || !current || current.missionId !== missionId) return { errors: { _form: "El aviso no existe." }, values: {} };
  const raw = formToObject(formData, [], ["pinned"]);
  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  await updateAnnouncement(id, parsed.data, user.name);
  revalidate(missionId, mission.slug);
  return { errors: {}, values: {}, saved: true };
}

export async function deleteAnnouncementAction(missionId: string, id: string): Promise<void> {
  const user = await requireUser(`/admin/m/${missionId}/avisos/${id}`);
  const [mission, current] = await Promise.all([getMissionById(missionId), getAnnouncement(id)]);
  if (!mission || !current || current.missionId !== missionId || !can(user.role, "program.manage")) redirect(`/admin/m/${missionId}?denegado=1`);
  await deleteAnnouncement(id, user.name);
  revalidate(missionId, mission.slug);
  redirect(`/admin/m/${missionId}/avisos`);
}
