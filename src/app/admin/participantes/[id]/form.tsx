"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { REGISTRATION_STATUS, ROLES } from "@/lib/catalogs";
import type { MissionRegistration, Organization, Volunteer } from "@/lib/db/schema";
import { updateParticipant, type ParticipantFormState } from "./actions";

type Props = { registration: MissionRegistration; volunteer: Volunteer; organizations: Organization[] };

export function ParticipantForm({ registration, volunteer, organizations }: Props) {
  const action = updateParticipant.bind(null, registration.id);
  const [state, formAction, pending] = useActionState<ParticipantFormState, FormData>(action, { errors: {} });
  const { errors } = state;
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;

  return (
    <form action={formAction} className="card space-y-4" noValidate>
      <h2 className="section-title">Gestión</h2>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {state.saved ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">Cambios guardados.</div> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estado" htmlFor="status" error={errors.status} required>
          <select id="status" name="status" className={cls("status")} defaultValue={registration.status}>
            {REGISTRATION_STATUS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rol asignado" htmlFor="assignedRole" error={errors.assignedRole}>
          <select id="assignedRole" name="assignedRole" className={cls("assignedRole")} defaultValue={registration.assignedRole ?? ""}>
            <option value="">Sin asignar</option>
            {ROLES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notas internas del equipo" htmlFor="adminNotes" error={errors.adminNotes}>
        <textarea id="adminNotes" name="adminNotes" rows={3} className={cls("adminNotes")} defaultValue={registration.adminNotes ?? ""} />
      </Field>
      <h3 className="pt-2 text-sm font-semibold text-slate-700">Datos de contacto</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" htmlFor="fullName" error={errors.fullName} required>
          <input id="fullName" name="fullName" className={cls("fullName")} defaultValue={volunteer.fullName} />
        </Field>
        <Field label="Grupo" htmlFor="organizationId" error={errors.organizationId}>
          <select id="organizationId" name="organizationId" className={cls("organizationId")} defaultValue={volunteer.organizationId ?? ""}>
            <option value="">Otro / ninguno</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Celular" htmlFor="phone" error={errors.phone} required>
          <input id="phone" name="phone" className={cls("phone")} defaultValue={volunteer.phone} />
        </Field>
        <Field label="Correo" htmlFor="email" error={errors.email}>
          <input id="email" name="email" className={cls("email")} defaultValue={volunteer.email ?? ""} />
        </Field>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
