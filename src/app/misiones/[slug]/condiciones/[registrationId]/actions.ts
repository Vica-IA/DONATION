"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTermsContext, recordTermsAcceptance, termsDeclarationList } from "@/lib/data";
import { normalizeName } from "@/lib/format";
import { flattenErrors, formToObject, termsAcceptanceSchema, type FieldErrors } from "@/lib/validation";

export type TermsState = { errors: FieldErrors; values: Record<string, unknown> };

export async function acceptTerms(slug: string, registrationId: string, _prev: TermsState, formData: FormData): Promise<TermsState> {
  const ctx = await getTermsContext(slug, registrationId);
  if (!ctx) return { errors: { _form: "No encontramos tu inscripción." }, values: {} };
  if (ctx.acceptance) redirect(`/misiones/${slug}/condiciones/${registrationId}`);

  const raw = formToObject(formData, ["declarations"]);
  const parsed = termsAcceptanceSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };

  const errors: FieldErrors = {};
  const declarations = termsDeclarationList(ctx.mission);
  const checked = new Set(parsed.data.declarations);
  const missing = declarations.filter((_, i) => !checked.has(String(i)));
  if (missing.length > 0) errors.declarations = `Debes marcar todas las casillas (faltan ${missing.length}).`;

  let imageConsent: boolean | null = null;
  if (ctx.mission.termsImageConsent) {
    if (parsed.data.imageConsent === "si") imageConsent = true;
    else if (parsed.data.imageConsent === "no") imageConsent = false;
    else errors.imageConsent = "Indica si autorizas o no el uso de tu imagen.";
  }

  if (normalizeName(parsed.data.signedName) !== normalizeName(ctx.volunteer.fullName)) {
    errors.signedName = `Escribe tu nombre exactamente como lo registraste: ${ctx.volunteer.fullName}`;
  }

  if (Object.keys(errors).length > 0) return { errors, values: raw };

  const userAgent = (await headers()).get("user-agent");
  try {
    await recordTermsAcceptance(ctx, {
      declarations: declarations.filter((_, i) => checked.has(String(i))),
      imageConsent,
      signedName: parsed.data.signedName,
      signedCity: parsed.data.signedCity,
      userAgent: userAgent ? userAgent.slice(0, 300) : null,
    });
  } catch (err) {
    console.error("Error registrando aceptación de condiciones", err);
    return { errors: { _form: "No pudimos guardar tu aceptación. Intenta de nuevo." }, values: raw };
  }
  redirect(`/misiones/${slug}/condiciones/${registrationId}?ok=1`);
}
