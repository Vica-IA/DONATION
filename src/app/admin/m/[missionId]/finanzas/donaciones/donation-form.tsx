"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui";
import { DONATION_STATUS, DONATION_TYPES, type DonationType } from "@/lib/catalogs";
import { createDonationAction, type DonationFormState } from "./actions";

const EMPTY: DonationFormState = { errors: {}, values: {} };

const TYPE_HELP: Record<DonationType, string> = {
  dinero: "Transferencia, Nequi, efectivo… Entra como ingreso recibido.",
  especie: "Materiales, alimentos, transporte, servicios… Se registra con su valor estimado.",
};

export function DonationForm({ missionId }: { missionId: string }) {
  const action = createDonationAction.bind(null, missionId);
  const [state, formAction, pending] = useActionState<DonationFormState, FormData>(action, EMPTY);
  const { errors, values } = state;
  const str = (key: string, fallback = "") => (typeof values[key] === "string" ? (values[key] as string) : fallback);
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;
  const initialType: DonationType = str("donationType", "dinero") === "especie" ? "especie" : "dinero";
  const [type, setType] = useState<DonationType>(initialType);
  // Tras registrar, el formulario queda vacío (React lo restablece) y el tipo vuelve a "dinero".
  const [lastSaved, setLastSaved] = useState(state.saved?.id);
  if (state.saved?.id !== lastSaved) {
    setLastSaved(state.saved?.id);
    setType("dinero");
  }
  const inKind = type === "especie";

  return (
    <form action={formAction} className="card space-y-4" id="nueva-donacion" noValidate>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">Registrar donación</h2>
        <span className="text-xs text-muted">Queda como ingreso de la misión en Finanzas.</span>
      </div>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {state.saved ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800" role="status">
          Donación registrada: {state.saved.label}.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {DONATION_TYPES.map((t) => (
          <label key={t.value} className="choice">
            <input type="radio" name="donationType" value={t.value} defaultChecked={initialType === t.value} onChange={() => setType(t.value)} className="mt-0.5" />
            <span>
              <span className="font-semibold">{t.label}</span>
              <span className="block text-xs text-muted">{TYPE_HELP[t.value]}</span>
            </span>
          </label>
        ))}
      </div>
      {errors.donationType ? <p className="error">{errors.donationType}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Quién dona" htmlFor="donor" error={errors.donor} required help="Persona, familia, empresa, parroquia o entidad.">
          <input id="donor" name="donor" className={cls("donor")} defaultValue={str("donor")} placeholder="Ej. Familia Restrepo" />
        </Field>
        <Field label={inKind ? "Valor estimado (COP)" : "Valor (COP)"} htmlFor="amount" error={errors.amount} required help="Sin decimales. Puedes escribir 500.000 o 500000.">
          <input id="amount" name="amount" inputMode="numeric" className={cls("amount")} defaultValue={str("amount")} placeholder="500.000" />
        </Field>
        <Field label="Estado" htmlFor="status" error={errors.status} required help="Prometida: acordada pero todavía no llega.">
          <select id="status" name="status" className={cls("status")} defaultValue={str("status", "recibida")}>
            {DONATION_STATUS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={inKind ? "Qué se donó" : "Destino o descripción"} htmlFor="description" error={errors.description} required={inKind}>
          <input
            id="description"
            name="description"
            className={cls("description")}
            defaultValue={str("description")}
            placeholder={inKind ? "Ej. 20 bultos de cemento, 50 mercados" : "Ej. Para materiales de la vivienda (opcional)"}
          />
        </Field>
        <Field label="Fecha" htmlFor="entryDate" error={errors.entryDate} help="Cuándo se recibió o se acordó.">
          <input id="entryDate" name="entryDate" type="date" className={cls("entryDate")} defaultValue={str("entryDate")} />
        </Field>
        <Field label="Medio y referencia" htmlFor="reference" error={errors.reference} help="Transferencia, Nequi, efectivo; número de comprobante si lo hay.">
          <input id="reference" name="reference" className={cls("reference")} defaultValue={str("reference")} placeholder="Ej. Transferencia Bancolombia 29/09" />
        </Field>
      </div>

      <Field label="Notas" htmlFor="notes" error={errors.notes} help="Contacto del donante, condiciones, agradecimiento enviado…">
        <textarea id="notes" name="notes" rows={2} className={cls("notes")} defaultValue={str("notes")} />
      </Field>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Registrar donación"}
      </button>
    </form>
  );
}
