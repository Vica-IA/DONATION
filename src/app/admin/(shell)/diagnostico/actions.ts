"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { relinkOrphanRegistrations } from "@/lib/diagnostics";

/** Vincula las inscripciones huérfanas a la misión elegida (solo administrador, con confirmación). */
export async function relinkOrphansAction(formData: FormData): Promise<void> {
  const user = await requirePermission("users.manage", "/admin/diagnostico");
  const missionId = String(formData.get("missionId") ?? "");
  const confirmed = formData.get("confirm") === "on";
  if (!missionId || !confirmed) redirect("/admin/diagnostico?vinculadas=0");
  const n = await relinkOrphanRegistrations(missionId, user.name);
  revalidatePath("/admin", "layout");
  redirect(`/admin/diagnostico?vinculadas=${n}`);
}
