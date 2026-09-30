"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { AREAS, GENERAL_AREA } from "@/lib/catalogs";
import type { SquadWithMembers } from "@/lib/program";
import { createSquadAction, updateSquadAction, type SquadFormState } from "./actions";

const EMPTY: SquadFormState = { errors: {}, values: {} };

export function SquadForm({ missionId, squad }: { missionId: string; squad?: SquadWithMembers | null }) {
  const action = squad ? updateSquadAction.bind(null, missionId, squad.id) : createSquadAction.bind(null, missionId);
  const [state, formAction, pending] = useActionState<SquadFormState, FormData>(action, EMPTY);
  const { errors, values } = state;
  const str = (key: string, fallback = "") => (typeof values[key] === "string" ? (values[key] as string) : fallback);
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;

  return (
    <form action={formAction} className="card space-y-4" noValidate>
      <h2 className="section-title">{squad ? "Datos de la cuadrilla" : "Nueva cuadrilla"}</h2>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {state.saved ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">Cambios guardados.</div> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="name" error={errors.name} required>
          <input id="name" name="name" className={cls("name")} defaultValue={str("name", squad?.name ?? "")} placeholder="Ej. Cuadrilla Obra 1" />
        </Field>
        <Field label="Área" htmlFor="area" error={errors.area}>
          <select id="area" name="area" className={cls("area")} defaultValue={str("area", squad?.area ?? "")}>
            <option value="">Sin área</option>
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
            <option value={GENERAL_AREA.value}>{GENERAL_AREA.label}</option>
          </select>
        </Field>
      </div>
      {squad ? (
        <Field label="Líder" htmlFor="leaderRegistrationId" error={errors.leaderRegistrationId} help="Debe ser integrante; agrega primero a las personas.">
          <select id="leaderRegistrationId" name="leaderRegistrationId" className={cls("leaderRegistrationId")} defaultValue={str("leaderRegistrationId", squad.leaderRegistrationId ?? "")}>
            <option value="">Sin líder</option>
            {squad.members.map((m) => (
              <option key={m.registrationId} value={m.registrationId}>
                {m.fullName}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Punto de encuentro" htmlFor="meetingPoint" error={errors.meetingPoint}>
          <input id="meetingPoint" name="meetingPoint" className={cls("meetingPoint")} defaultValue={str("meetingPoint", squad?.meetingPoint ?? "")} placeholder="Ej. Frente a la escuela, 7:00 a. m." />
        </Field>
        <Field label="Notas" htmlFor="notes" error={errors.notes} help="Se muestran en la página pública.">
          <input id="notes" name="notes" className={cls("notes")} defaultValue={str("notes", squad?.notes ?? "")} />
        </Field>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : squad ? "Guardar cambios" : "Crear cuadrilla"}
      </button>
    </form>
  );
}
