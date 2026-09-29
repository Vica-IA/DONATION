"use client";

import { useActionState } from "react";
import { acceptTerms, type TermsState } from "./actions";

type Props = {
  slug: string;
  registrationId: string;
  declarations: string[];
  askImageConsent: boolean;
  fullName: string;
};

const EMPTY: TermsState = { errors: {}, values: {} };

export function TermsForm({ slug, registrationId, declarations, askImageConsent, fullName }: Props) {
  const action = acceptTerms.bind(null, slug, registrationId);
  const [state, formAction, pending] = useActionState<TermsState, FormData>(action, EMPTY);
  const { errors } = state;

  return (
    <form action={formAction} className="card space-y-4" noValidate>
      {errors._form ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {errors._form}
        </div>
      ) : null}
      <h2 className="section-title">Aceptación</h2>
      {declarations.length > 0 ? (
        <details className="rounded-xl border border-line p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Al aceptar declaras estas {declarations.length} cosas</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
            {declarations.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
        </details>
      ) : null}
      {askImageConsent ? (
        <p className="text-xs text-muted">
          Incluye la autorización para captar y usar tu imagen, voz y testimonio en fotografías, videos y publicaciones de la misión, con fines de difusión,
          memoria institucional y sensibilización, sin contraprestación económica.
        </p>
      ) : null}
      <label className={`choice ${errors.accepted ? "border-red-400" : ""}`}>
        <input type="checkbox" name="accepted" className="mt-0.5 shrink-0" />
        <span>
          He leído y acepto las condiciones de participación, incluidas las declaraciones{askImageConsent ? " y la autorización de uso de imagen" : ""}. Acepto
          como <span className="font-medium text-ink">{fullName}</span>.
        </span>
      </label>
      {errors.accepted ? <p className="error">{errors.accepted}</p> : null}
      <button type="submit" className="btn-primary w-full py-3 text-base" disabled={pending}>
        {pending ? "Guardando…" : "Acepto las condiciones de participación"}
      </button>
      <p className="text-xs text-muted">Se guardará la fecha y hora de tu aceptación y la versión exacta del documento.</p>
    </form>
  );
}
