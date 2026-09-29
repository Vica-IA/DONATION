"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTermsContext, recordTermsAcceptance, termsDeclarationList } from "@/lib/data";
import { flattenErrors, formToObject, termsAcceptanceSchema, type FieldErrors } from "@/lib/validation";

export type TermsState = { errors: FieldErrors; values: Record<string, unknown> };

/** Aceptación por enlace personal (p. ej. cuando cambia la versión del documento). */
export async function acceptTerms(slug: string, registrationId: string, _prev: TermsState, formData: FormData): Promise<TermsState> {
  const ctx = await getTermsContext(slug, registrationId);
  if (!ctx) return { errors: { _form: "No encontramos tu inscripción." }, values: {} };
  if (ctx.acceptance) redirect(`/misiones/${slug}/condiciones/${registrationId}`);

  const raw = formToObject(formData, [], ["accepted"]);
  const parsed = termsAcceptanceSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };

  const userAgent = (await headers()).get("user-agent");
  try {
    await recordTermsAcceptance(ctx, {
      declarations: termsDeclarationList(ctx.mission),
      imageConsent: ctx.mission.termsImageConsent ? true : null,
      signedName: ctx.volunteer.fullName,
      signedCity: ctx.volunteer.city ?? "",
      userAgent: userAgent ? userAgent.slice(0, 300) : null,
    });
  } catch (err) {
    console.error("Error registrando aceptación de condiciones", err);
    return { errors: { _form: "No pudimos guardar tu aceptación. Intenta de nuevo." }, values: raw };
  }
  redirect(`/misiones/${slug}/condiciones/${registrationId}?ok=1`);
}
