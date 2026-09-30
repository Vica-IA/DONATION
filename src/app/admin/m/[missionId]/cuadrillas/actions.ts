"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { can } from "@/lib/permissions";
import { createSquad, deleteSquad, getSquad, setSquadMembers, updateSquad } from "@/lib/program";
import { flattenErrors, formToObject, squadSchema, type FieldErrors } from "@/lib/validation";

export type SquadFormState = { errors: FieldErrors; values: Record<string, unknown>; saved?: boolean };

function revalidate(missionId: string, slug: string) {
  revalidatePath(`/admin/m/${missionId}`, "layout");
  revalidatePath(`/misiones/${slug}`);
}

export async function createSquadAction(missionId: string, _prev: SquadFormState, formData: FormData): Promise<SquadFormState> {
  const user = await requireUser(`/admin/m/${missionId}/cuadrillas`);
  if (!can(user.role, "program.manage")) return { errors: { _form: "No tienes permiso para crear cuadrillas." }, values: {} };
  const mission = await getMissionById(missionId);
  if (!mission) return { errors: { _form: "La misión no existe." }, values: {} };
  const raw = formToObject(formData);
  const parsed = squadSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  const squad = await createSquad(missionId, { ...parsed.data, leaderRegistrationId: "" }, user.name);
  revalidate(missionId, mission.slug);
  redirect(`/admin/m/${missionId}/cuadrillas/${squad.id}`);
}

export async function updateSquadAction(missionId: string, squadId: string, _prev: SquadFormState, formData: FormData): Promise<SquadFormState> {
  const user = await requireUser(`/admin/m/${missionId}/cuadrillas/${squadId}`);
  if (!can(user.role, "program.manage")) return { errors: { _form: "No tienes permiso para editar cuadrillas." }, values: {} };
  const [mission, squad] = await Promise.all([getMissionById(missionId), getSquad(squadId)]);
  if (!mission || !squad || squad.missionId !== missionId) return { errors: { _form: "La cuadrilla no existe." }, values: {} };
  const raw = formToObject(formData);
  const parsed = squadSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  if (parsed.data.leaderRegistrationId && !squad.members.some((m) => m.registrationId === parsed.data.leaderRegistrationId)) {
    return { errors: { leaderRegistrationId: "El líder debe ser integrante de la cuadrilla." }, values: raw };
  }
  await updateSquad(squadId, parsed.data, user.name);
  revalidate(missionId, mission.slug);
  return { errors: {}, values: {}, saved: true };
}

/** Integrantes: casillas con el id de inscripción (solo confirmados). */
export async function setSquadMembersAction(missionId: string, squadId: string, formData: FormData): Promise<void> {
  const user = await requireUser(`/admin/m/${missionId}/cuadrillas/${squadId}`);
  const [mission, squad] = await Promise.all([getMissionById(missionId), getSquad(squadId)]);
  if (!mission || !squad || squad.missionId !== missionId || !can(user.role, "program.manage")) redirect(`/admin/m/${missionId}?denegado=1`);
  const ids = formData
    .getAll("members")
    .filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 64)
    .slice(0, 500);
  await setSquadMembers(squad, ids, user.name);
  revalidate(missionId, mission.slug);
  redirect(`/admin/m/${missionId}/cuadrillas/${squadId}?integrantes=ok`);
}

export async function deleteSquadAction(missionId: string, squadId: string): Promise<void> {
  const user = await requireUser(`/admin/m/${missionId}/cuadrillas/${squadId}`);
  const [mission, squad] = await Promise.all([getMissionById(missionId), getSquad(squadId)]);
  if (!mission || !squad || squad.missionId !== missionId || !can(user.role, "program.manage")) redirect(`/admin/m/${missionId}?denegado=1`);
  await deleteSquad(squadId, user.name);
  revalidate(missionId, mission.slug);
  redirect(`/admin/m/${missionId}/cuadrillas`);
}
