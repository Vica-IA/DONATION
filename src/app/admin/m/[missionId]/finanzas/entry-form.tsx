"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui";
import { AREAS, FINANCE_KINDS, FINANCE_STATUS, FINANCE_STATUS_HELP, GENERAL_AREA, financeCategoriesFor, type FinanceKind } from "@/lib/catalogs";
import type { FinanceRow } from "@/lib/finance";
import { createEntryAction, updateEntryAction, type FinanceFormState } from "./actions";

type Person = { id: string; label: string };

type Props = {
  missionId: string;
  entry?: FinanceRow | null;
  people: Person[];
  defaultKind?: FinanceKind;
};

const EMPTY: FinanceFormState = { errors: {}, values: {} };

export function EntryForm({ missionId, entry, people, defaultKind = "gasto" }: Props) {
  const action = entry ? updateEntryAction.bind(null, missionId, entry.id) : createEntryAction.bind(null, missionId);
  const [state, formAction, pending] = useActionState<FinanceFormState, FormData>(action, EMPTY);
  const { errors, values } = state;
  const str = (key: string, fallback = "") => (typeof values[key] === "string" ? (values[key] as string) : fallback);
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;
  const initialKind = (str("kind", entry?.kind ?? defaultKind) as FinanceKind) || defaultKind;
  const [kind, setKind] = useState<FinanceKind>(initialKind);
  const categories = financeCategoriesFor(kind);
  const categoryDefault = str("category", entry?.category ?? "");
  const categoryValue = categories.some((c) => c.value === categoryDefault) ? categoryDefault : categories[0].value;

  return (
    <form action={formAction} className="card space-y-4" noValidate>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {state.saved && entry ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">Cambios guardados.</div> : null}
      {state.saved && !entry ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">Movimiento registrado.</div> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {FINANCE_KINDS.map((k) => (
          <label key={k.value} className="choice">
            <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="mt-0.5" />
            <span>
              <span className="font-semibold">{k.label}</span>
              <span className="block text-xs text-muted">{k.value === "gasto" ? "Costos de la misión: transporte, alimentación, materiales…" : "Donaciones, patrocinios, recaudación y otros ingresos."}</span>
            </span>
          </label>
        ))}
      </div>
      {errors.kind ? <p className="error">{errors.kind}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Categoría" htmlFor="category" error={errors.category} required>
          <select key={kind} id="category" name="category" className={cls("category")} defaultValue={categoryValue}>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado" htmlFor="status" error={errors.status} required help={FINANCE_STATUS.map((s) => `${s.label}: ${FINANCE_STATUS_HELP[s.value]}`).join(" ")}>
          <select id="status" name="status" className={cls("status")} defaultValue={str("status", entry?.status ?? "proyectado")}>
            {FINANCE_STATUS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor (COP)" htmlFor="amount" error={errors.amount} required help="Sin decimales. Puedes escribir 1.500.000 o 1500000.">
          <input id="amount" name="amount" inputMode="numeric" className={cls("amount")} defaultValue={str("amount", entry ? String(entry.amount) : "")} placeholder="1.500.000" />
        </Field>
      </div>

      <Field label="Concepto" htmlFor="concept" error={errors.concept} required>
        <input id="concept" name="concept" className={cls("concept")} defaultValue={str("concept", entry?.concept ?? "")} placeholder={kind === "gasto" ? "Ej. Bus Medellín – Tadó ida y regreso (40 personas)" : "Ej. Donación parroquia San José"} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha" htmlFor="entryDate" error={errors.entryDate} help="Real si ya ocurrió; prevista si es una proyección.">
          <input id="entryDate" name="entryDate" type="date" className={cls("entryDate")} defaultValue={str("entryDate", entry?.entryDate ?? "")} />
        </Field>
        <Field label="Área responsable" htmlFor="area" error={errors.area}>
          <select id="area" name="area" className={cls("area")} defaultValue={str("area", entry?.area ?? "")}>
            <option value="">Sin área</option>
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
            <option value={GENERAL_AREA.value}>{GENERAL_AREA.label}</option>
          </select>
        </Field>
        <Field label="Responsable" htmlFor="ownerUserId" error={errors.ownerUserId}>
          <select id="ownerUserId" name="ownerUserId" className={cls("ownerUserId")} defaultValue={str("ownerUserId", entry?.ownerUserId ?? "")}>
            <option value="">Coordinación financiera</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={kind === "gasto" ? "Proveedor" : "Donante o entidad"} htmlFor="counterparty" error={errors.counterparty}>
          <input id="counterparty" name="counterparty" className={cls("counterparty")} defaultValue={str("counterparty", entry?.counterparty ?? "")} />
        </Field>
        <Field label="Referencia" htmlFor="reference" error={errors.reference} help="Factura, recibo, comprobante o consignación.">
          <input id="reference" name="reference" className={cls("reference")} defaultValue={str("reference", entry?.reference ?? "")} />
        </Field>
      </div>

      <Field label="Notas" htmlFor="notes" error={errors.notes}>
        <textarea id="notes" name="notes" rows={2} className={cls("notes")} defaultValue={str("notes", entry?.notes ?? "")} />
      </Field>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : entry ? "Guardar cambios" : "Registrar movimiento"}
        </button>
      </div>
    </form>
  );
}
