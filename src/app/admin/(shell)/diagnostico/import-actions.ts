"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { importRegistrationsCsv, type ImportSummary } from "@/lib/import-csv";

export type ImportState = { summary?: ImportSummary; error?: string };

/** Importa un CSV (formato del panel) a la misión elegida. Solo administrador. */
export async function importCsvAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requirePermission("users.manage", "/admin/diagnostico");
  const missionId = String(formData.get("missionId") ?? "");
  const file = formData.get("archivo");
  if (formData.get("confirm") !== "on") return { error: "Marca la casilla de confirmación." };
  const mission = await getMissionById(missionId);
  if (!mission) return { error: "Elige una misión válida." };
  if (!(file instanceof File) || file.size === 0) return { error: "Adjunta el archivo CSV." };
  if (file.size > 5 * 1024 * 1024) return { error: "El archivo supera 5 MB." };
  const text = await file.text();
  const summary = await importRegistrationsCsv(mission, text, user.name);
  revalidatePath("/admin", "layout");
  return { summary };
}
