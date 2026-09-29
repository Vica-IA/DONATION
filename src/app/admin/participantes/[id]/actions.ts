"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { getRegistration, updateRegistrationByAdmin } from "@/lib/data";
import { adminRegistrationSchema, flattenErrors, formToObject, type FieldErrors } from "@/lib/validation";

export type ParticipantFormState = { errors: FieldErrors; saved?: boolean };

export async function updateParticipant(id: string, _prev: ParticipantFormState, formData: FormData): Promise<ParticipantFormState> {
  const user = await requirePermission("participants.manage", `/admin/participantes/${id}`);
  const current = await getRegistration(id);
  if (!current) return { errors: { _form: "La inscripción no existe." } };
  const parsed = adminRegistrationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { errors: flattenErrors(parsed.error) };
  try {
    await updateRegistrationByAdmin(id, parsed.data, user.name);
  } catch (err) {
    console.error(err);
    return { errors: { _form: "No fue posible guardar los cambios." } };
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/misiones/${current.mission.id}`);
  revalidatePath(`/admin/participantes/${id}`);
  return { errors: {}, saved: true };
}
