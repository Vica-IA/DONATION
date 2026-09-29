"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { MISSION_STATUS } from "@/lib/catalogs";
import type { Mission } from "@/lib/db/schema";
import { saveMission, type MissionFormState } from "./actions";

export function MissionForm({ mission }: { mission: Mission | null }) {
  const action = saveMission.bind(null, mission?.id ?? null);
  const [state, formAction, pending] = useActionState<MissionFormState, FormData>(action, { errors: {}, values: {} });
  const { errors, values } = state;
  const v = (key: keyof Mission): string => {
    const fromState = values[key as string];
    if (typeof fromState === "string") return fromState;
    const fromMission = mission?.[key];
    return fromMission === null || fromMission === undefined ? "" : String(fromMission);
  };
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;
  const openDefault = values.registrationOpen !== undefined ? values.registrationOpen === true : (mission?.registrationOpen ?? true);
  const imageConsentDefault = values.termsImageConsent !== undefined ? values.termsImageConsent === true : (mission?.termsImageConsent ?? true);

  return (
    <form action={formAction} className="card space-y-5" noValidate>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      <Field label="Nombre" htmlFor="name" error={errors.name} required>
        <input id="name" name="name" className={cls("name")} defaultValue={v("name")} placeholder="Misión Chocó 01" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código" htmlFor="code" error={errors.code} required help="Identificador interno, p. ej. CHO-2026-01">
          <input id="code" name="code" className={cls("code")} defaultValue={v("code")} />
        </Field>
        <Field label="Identificador en la URL" htmlFor="slug" error={errors.slug} required help="Solo minúsculas, números y guiones. Ej.: choco-2026-01">
          <input id="slug" name="slug" className={cls("slug")} defaultValue={v("slug")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha de inicio" htmlFor="startDate" error={errors.startDate} required>
          <input id="startDate" name="startDate" type="date" className={cls("startDate")} defaultValue={v("startDate")} />
        </Field>
        <Field label="Fecha de fin" htmlFor="endDate" error={errors.endDate} required>
          <input id="endDate" name="endDate" type="date" className={cls("endDate")} defaultValue={v("endDate")} />
        </Field>
        <Field label="Cupos" htmlFor="capacity" error={errors.capacity} required>
          <input id="capacity" name="capacity" type="number" min={1} className={cls("capacity")} defaultValue={v("capacity") || "40"} />
        </Field>
      </div>
      <Field label="Lugar / territorio" htmlFor="location" error={errors.location}>
        <input id="location" name="location" className={cls("location")} defaultValue={v("location")} />
      </Field>
      <Field label="Descripción (visible en el formulario)" htmlFor="description" error={errors.description}>
        <textarea id="description" name="description" rows={3} className={cls("description")} defaultValue={v("description")} />
      </Field>
      <Field label="Punto de encuentro" htmlFor="meetingPoint" error={errors.meetingPoint}>
        <input id="meetingPoint" name="meetingPoint" className={cls("meetingPoint")} defaultValue={v("meetingPoint")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contacto de coordinación" htmlFor="contactName" error={errors.contactName}>
          <input id="contactName" name="contactName" className={cls("contactName")} defaultValue={v("contactName")} />
        </Field>
        <Field label="Teléfono de coordinación" htmlFor="contactPhone" error={errors.contactPhone}>
          <input id="contactPhone" name="contactPhone" className={cls("contactPhone")} defaultValue={v("contactPhone")} />
        </Field>
      </div>
      <Field label="Aporte por persona (COP)" htmlFor="contributionAmount" error={errors.contributionAmount} help="Informativo: se muestra en el formulario. Vacío = no se menciona.">
        <input id="contributionAmount" name="contributionAmount" type="number" min={0} step={1000} className={cls("contributionAmount")} defaultValue={v("contributionAmount")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estado" htmlFor="status" error={errors.status} required>
          <select id="status" name="status" className={cls("status")} defaultValue={v("status") || "convocatoria"}>
            {MISSION_STATUS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <label className="choice self-end">
          <input type="checkbox" name="registrationOpen" defaultChecked={openDefault} className="mt-0.5" />
          <span>Inscripciones abiertas (el formulario público acepta respuestas)</span>
        </label>
      </div>
      <div className="space-y-4 border-t border-line pt-5">
        <div>
          <h2 className="section-title">Condiciones de participación</h2>
          <p className="text-sm text-muted">
            Documento que cada persona confirmada debe leer y aceptar (consentimiento informado). Se escribe en Markdown: <code>#</code> títulos,{" "}
            <code>**negrita**</code>, listas con <code>-</code>.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Versión del documento" htmlFor="termsVersion" error={errors.termsVersion} required help="Súbela cuando el texto cambie de fondo: todos deberán aceptarlo de nuevo.">
            <input id="termsVersion" name="termsVersion" type="number" min={1} className={cls("termsVersion")} defaultValue={v("termsVersion") || "1"} />
          </Field>
          <label className="choice self-end">
            <input type="checkbox" name="termsImageConsent" defaultChecked={imageConsentDefault} className="mt-0.5" />
            <span>Preguntar autorización de uso de imagen (SÍ / NO) al aceptar</span>
          </label>
        </div>
        <Field label="Casillas de aceptación (una por línea)" htmlFor="termsDeclarations" error={errors.termsDeclarations} help="Cada línea es una casilla obligatoria al final del documento.">
          <textarea id="termsDeclarations" name="termsDeclarations" rows={8} className={cls("termsDeclarations")} defaultValue={v("termsDeclarations")} />
        </Field>
        <Field label="Texto del documento (Markdown)" htmlFor="termsMarkdown" error={errors.termsMarkdown} help="Vacío = la misión no pide condiciones.">
          <textarea id="termsMarkdown" name="termsMarkdown" rows={18} className={`${cls("termsMarkdown")} font-mono text-xs`} defaultValue={v("termsMarkdown")} />
        </Field>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : mission ? "Guardar cambios" : "Crear misión"}
        </button>
      </div>
    </form>
  );
}
