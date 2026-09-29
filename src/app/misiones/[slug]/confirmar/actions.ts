"use server";

import { redirect } from "next/navigation";
import { KAIROS_SLUG } from "@/lib/catalogs";
import { getMissionBySlug, listOrganizations, submitRegistration } from "@/lib/data";
import { isEphemeralDb } from "@/lib/db";
import { flattenErrors, formToObject, registrationSchema, type FieldErrors } from "@/lib/validation";

export type ConfirmState = {
  errors: FieldErrors;
  values: Record<string, unknown>;
  message?: string;
};

export async function confirmParticipation(
  slug: string,
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const mission = await getMissionBySlug(slug);
  if (!mission) {
    return { errors: { _form: "La misión no existe." }, values: {} };
  }
  if (!mission.registrationOpen || isEphemeralDb()) {
    return { errors: { _form: "Las inscripciones de esta misión no están abiertas todavía." }, values: {} };
  }

  // Trampa para bots: un humano nunca ve ni llena este campo.
  if (typeof formData.get("website") === "string" && (formData.get("website") as string).length > 0) {
    redirect(`/misiones/${slug}/gracias?estado=confirmado`);
  }

  const raw = formToObject(formData, ["skills"], ["constructionExperience", "dataConsent"]);
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: flattenErrors(parsed.error),
      values: raw,
      message: "Revisa los campos marcados en rojo.",
    };
  }

  // El grupo debe ser uno de los registrados; Grupo Kairós pide además el refugio.
  const orgs = await listOrganizations();
  const org = orgs.find((o) => o.id === parsed.data.organizationId);
  if (!org) return { errors: { organizationId: "Elige tu grupo" }, values: raw, message: "Revisa los campos marcados en rojo." };
  const isKairos = org.slug === KAIROS_SLUG;
  if (isKairos && !parsed.data.refugio) return { errors: { refugio: "Indica tu refugio" }, values: raw, message: "Revisa los campos marcados en rojo." };
  const data = { ...parsed.data, refugio: isKairos ? parsed.data.refugio : null };

  let result;
  try {
    result = await submitRegistration(mission, data);
  } catch (err) {
    console.error("Error registrando confirmación", err);
    return {
      errors: { _form: "No pudimos guardar tu respuesta. Intenta de nuevo en un momento." },
      values: raw,
    };
  }

  const params = new URLSearchParams({
    estado: result.status,
    nombre: parsed.data.fullName.split(" ")[0] ?? "",
    r: result.registrationId,
    ...(result.isUpdate ? { actualizado: "1" } : {}),
  });
  redirect(`/misiones/${slug}/gracias?${params.toString()}`);
}
