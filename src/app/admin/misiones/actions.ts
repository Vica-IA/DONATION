"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createMission, getMissionById, updateMission } from "@/lib/data";
import { flattenErrors, formToObject, missionSchema, type FieldErrors } from "@/lib/validation";

export type MissionFormState = { errors: FieldErrors; values: Record<string, unknown> };

export async function saveMission(id: string | null, _prev: MissionFormState, formData: FormData): Promise<MissionFormState> {
  await requireAdmin(id ? `/admin/misiones/${id}/editar` : "/admin/misiones/nueva");
  const raw = formToObject(formData, [], ["registrationOpen"]);
  const parsed = missionSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };

  let targetId = id;
  try {
    if (id) {
      if (!(await getMissionById(id))) return { errors: { _form: "La misión no existe." }, values: raw };
      await updateMission(id, parsed.data);
    } else {
      targetId = (await createMission(parsed.data)).id;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const friendly = /UNIQUE/i.test(msg) ? "Ya existe una misión con ese código o identificador de URL." : "No fue posible guardar la misión.";
    return { errors: { _form: friendly }, values: raw };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin/misiones/${targetId}`);
}
