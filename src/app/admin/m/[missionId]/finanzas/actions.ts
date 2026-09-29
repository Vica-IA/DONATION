"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { createEntry, deleteEntry, getEntry, updateEntry } from "@/lib/finance";
import { canManageFinance } from "@/lib/permissions";
import { financeEntrySchema, flattenErrors, formToObject, type FieldErrors } from "@/lib/validation";

export type FinanceFormState = { errors: FieldErrors; values: Record<string, unknown>; saved?: boolean };

function revalidateMission(missionId: string) {
  revalidatePath(`/admin/m/${missionId}`, "layout");
}

export async function createEntryAction(missionId: string, _prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requireUser(`/admin/m/${missionId}/finanzas`);
  if (!canManageFinance(user)) return { errors: { _form: "No tienes permiso para registrar movimientos." }, values: {} };
  const mission = await getMissionById(missionId);
  if (!mission) return { errors: { _form: "La misión no existe." }, values: {} };
  const raw = formToObject(formData);
  const parsed = financeEntrySchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  await createEntry(missionId, parsed.data, user.name);
  revalidateMission(missionId);
  return { errors: {}, values: {}, saved: true };
}

export async function updateEntryAction(missionId: string, entryId: string, _prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requireUser(`/admin/m/${missionId}/finanzas/${entryId}`);
  if (!canManageFinance(user)) return { errors: { _form: "No tienes permiso para editar movimientos." }, values: {} };
  const entry = await getEntry(entryId);
  if (!entry || entry.missionId !== missionId) return { errors: { _form: "El movimiento no existe." }, values: {} };
  const raw = formToObject(formData);
  const parsed = financeEntrySchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  await updateEntry(entryId, parsed.data, user.name);
  revalidateMission(missionId);
  return { errors: {}, values: {}, saved: true };
}

export async function deleteEntryAction(missionId: string, entryId: string): Promise<void> {
  const user = await requireUser(`/admin/m/${missionId}/finanzas/${entryId}`);
  const entry = await getEntry(entryId);
  if (!entry || entry.missionId !== missionId || !canManageFinance(user)) redirect(`/admin/m/${missionId}?denegado=1`);
  await deleteEntry(entryId, user.name);
  revalidateMission(missionId);
  redirect(`/admin/m/${missionId}/finanzas`);
}
