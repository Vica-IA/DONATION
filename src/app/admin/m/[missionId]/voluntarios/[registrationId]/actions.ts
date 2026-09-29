"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRegistration, updateRegistrationByAdmin } from "@/lib/data";
import { canManageRegistration } from "@/lib/permissions";
import { adminRegistrationSchema, flattenErrors, formToObject, type FieldErrors } from "@/lib/validation";

export type ParticipantFormState = { errors: FieldErrors; saved?: boolean };

export async function updateParticipant(id: string, _prev: ParticipantFormState, formData: FormData): Promise<ParticipantFormState> {
  const current = await getRegistration(id);
  if (!current) return { errors: { _form: "La inscripción no existe." } };
  const user = await requireUser(`/admin/m/${current.mission.id}/voluntarios/${id}`);
  if (!canManageRegistration(user, current.volunteer.organizationId)) redirect(`/admin/m/${current.mission.id}?denegado=1`);
  const parsed = adminRegistrationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { errors: flattenErrors(parsed.error) };
  try {
    await updateRegistrationByAdmin(id, parsed.data, user.name);
  } catch (err) {
    console.error(err);
    return { errors: { _form: "No fue posible guardar los cambios." } };
  }
  revalidatePath(`/admin/m/${current.mission.id}`, "layout");
  return { errors: {}, saved: true };
}
