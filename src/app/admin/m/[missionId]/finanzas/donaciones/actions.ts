"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { createEntry, donationToEntryInput } from "@/lib/finance";
import { canManageFinance } from "@/lib/permissions";
import { donationSchema, flattenErrors, formToObject, type FieldErrors } from "@/lib/validation";

export type DonationFormState = { errors: FieldErrors; values: Record<string, unknown>; saved?: { id: string; label: string } };

/** Registra una donación recibida (o prometida) como ingreso de la misión. */
export async function createDonationAction(missionId: string, _prev: DonationFormState, formData: FormData): Promise<DonationFormState> {
  const user = await requireUser(`/admin/m/${missionId}/finanzas/donaciones`);
  if (!canManageFinance(user)) return { errors: { _form: "No tienes permiso para registrar donaciones." }, values: {} };
  const mission = await getMissionById(missionId);
  if (!mission) return { errors: { _form: "La misión no existe." }, values: {} };
  const raw = formToObject(formData);
  const parsed = donationSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  const entry = await createEntry(missionId, donationToEntryInput(parsed.data), user.name);
  revalidatePath(`/admin/m/${missionId}`, "layout");
  return { errors: {}, values: {}, saved: { id: entry.id, label: `${parsed.data.donor} · ${entry.concept}` } };
}
