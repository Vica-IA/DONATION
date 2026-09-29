"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { acceptTerms, type TermsState } from "./actions";

type Props = {
  slug: string;
  registrationId: string;
  declarations: string[];
  askImageConsent: boolean;
  fullName: string;
  docLabel: string;
};

const EMPTY: TermsState = { errors: {}, values: {} };

export function TermsForm({ slug, registrationId, declarations, askImageConsent, fullName, docLabel }: Props) {
  const action = acceptTerms.bind(null, slug, registrationId);
  const [state, formAction, pending] = useActionState<TermsState, FormData>(action, EMPTY);
  const { errors, values } = state;
  const checked = Array.isArray(values.declarations) ? (values.declarations as string[]) : [];
  const str = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "");

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {errors._form ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {errors._form}
        </div>
      ) : null}

      <section className="card space-y-3">
        <h2 className="section-title">Casillas de aceptación</h2>
        <p className="text-sm text-slate-600">Marca cada una solo si la has leído y estás de acuerdo. Todas son necesarias.</p>
        <div className="space-y-2">
          {declarations.map((text, i) => (
            <label key={i} className="choice">
              <input type="checkbox" name="declarations" value={String(i)} defaultChecked={checked.includes(String(i))} className="mt-0.5 shrink-0" />
              <span>{text}</span>
            </label>
          ))}
        </div>
        {errors.declarations ? <p className="error">{errors.declarations}</p> : null}
      </section>

      {askImageConsent ? (
        <section className="card space-y-3">
          <h2 className="section-title">Autorización de uso de imagen</h2>
          <p className="text-sm text-slate-600">
            Autorizo a la organización a captar y utilizar mi imagen, voz y testimonio en fotografías, videos y publicaciones con fines de
            difusión, memoria institucional y sensibilización de la misión, sin contraprestación económica. La negativa no afecta mi participación.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="choice">
              <input type="radio" name="imageConsent" value="si" defaultChecked={str("imageConsent") === "si"} className="mt-0.5" />
              <span>SÍ autorizo</span>
            </label>
            <label className="choice">
              <input type="radio" name="imageConsent" value="no" defaultChecked={str("imageConsent") === "no"} className="mt-0.5" />
              <span>NO autorizo</span>
            </label>
          </div>
          {errors.imageConsent ? <p className="error">{errors.imageConsent}</p> : null}
        </section>
      ) : null}

      <section className="card space-y-4">
        <h2 className="section-title">Firma</h2>
        <p className="text-sm text-slate-600">
          Documento registrado: <span className="font-medium text-ink">{docLabel}</span>. Para firmar, escribe tu nombre completo tal como lo
          registraste (<span className="font-medium text-ink">{fullName}</span>) y la ciudad desde la que aceptas.
        </p>
        <Field label="Nombre completo (firma)" htmlFor="signedName" error={errors.signedName} required>
          <input id="signedName" name="signedName" className={`input${errors.signedName ? " input-error" : ""}`} defaultValue={str("signedName")} autoComplete="off" />
        </Field>
        <Field label="Ciudad" htmlFor="signedCity" error={errors.signedCity} required>
          <input id="signedCity" name="signedCity" className={`input${errors.signedCity ? " input-error" : ""}`} defaultValue={str("signedCity")} placeholder="Medellín" />
        </Field>
        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={pending}>
          {pending ? "Guardando…" : "Acepto las condiciones de participación"}
        </button>
        <p className="text-xs text-slate-500">Se guardará la fecha y hora de tu aceptación, la versión del documento y los datos de firma.</p>
      </section>
    </form>
  );
}
