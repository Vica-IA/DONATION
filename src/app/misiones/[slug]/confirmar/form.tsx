"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import {
  ATTENDANCE,
  AVAILABILITY,
  BLOOD_TYPES,
  DOC_TYPES,
  ROLES,
  SHIRT_SIZES,
  SKILLS,
  TRANSPORT,
} from "@/lib/catalogs";
import type { Organization } from "@/lib/db/schema";
import { confirmParticipation, type ConfirmState } from "./actions";

const initialConfirmState: ConfirmState = { errors: {}, values: {} };

type Props = {
  slug: string;
  organizations: Organization[];
  missionDates: string;
};

function str(values: Record<string, unknown>, key: string): string {
  const v = values[key];
  return typeof v === "string" ? v : "";
}

function arr(values: Record<string, unknown>, key: string): string[] {
  const v = values[key];
  return Array.isArray(v) ? (v as string[]) : [];
}

function bool(values: Record<string, unknown>, key: string): boolean {
  return values[key] === true;
}

export function ConfirmForm({ slug, organizations, missionDates }: Props) {
  const action = confirmParticipation.bind(null, slug);
  const [state, formAction, pending] = useActionState<ConfirmState, FormData>(action, initialConfirmState);
  const { errors, values } = state;
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {errors._form ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {errors._form}
        </div>
      ) : state.message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="alert">
          {state.message}
        </div>
      ) : null}

      {/* Honeypot */}
      <div className="hidden" aria-hidden>
        <label>
          Sitio web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* 1. Participación */}
      <section className="card space-y-4">
        <h2 className="section-title">1. Tu participación</h2>
        <fieldset>
          <legend className="label">
            ¿Confirmas tu participación en la misión ({missionDates})? <span className="text-red-500">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {ATTENDANCE.map((o) => (
              <label key={o.value} className="choice">
                <input
                  type="radio"
                  name="attendance"
                  value={o.value}
                  defaultChecked={str(values, "attendance") === o.value}
                  className="mt-0.5"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {errors.attendance ? <p className="error">{errors.attendance}</p> : null}
        </fieldset>

        <fieldset>
          <legend className="label">
            Disponibilidad <span className="text-red-500">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {AVAILABILITY.map((o) => (
              <label key={o.value} className="choice">
                <input
                  type="radio"
                  name="availability"
                  value={o.value}
                  defaultChecked={(str(values, "availability") || "completa") === o.value}
                  className="mt-0.5"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {errors.availability ? <p className="error">{errors.availability}</p> : null}
        </fieldset>
        <Field label="Si es parcial, ¿qué días puedes?" htmlFor="availabilityNotes" error={errors.availabilityNotes}>
          <input id="availabilityNotes" name="availabilityNotes" className={cls("availabilityNotes")} defaultValue={str(values, "availabilityNotes")} placeholder="Ej.: llego el 10 en la noche" />
        </Field>

        <fieldset>
          <legend className="label">
            Transporte <span className="text-red-500">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TRANSPORT.map((o) => (
              <label key={o.value} className="choice">
                <input
                  type="radio"
                  name="transport"
                  value={o.value}
                  defaultChecked={(str(values, "transport") || "grupo") === o.value}
                  className="mt-0.5"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {errors.transport ? <p className="error">{errors.transport}</p> : null}
        </fieldset>

        <Field label="¿En qué te gustaría apoyar?" htmlFor="preferredRole" error={errors.preferredRole}>
          <select id="preferredRole" name="preferredRole" className={cls("preferredRole")} defaultValue={str(values, "preferredRole")}>
            <option value="">Selecciona una opción</option>
            {ROLES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {/* 2. Datos personales */}
      <section className="card space-y-4">
        <h2 className="section-title">2. Datos personales</h2>
        <Field label="Nombre completo" htmlFor="fullName" error={errors.fullName} required>
          <input id="fullName" name="fullName" className={cls("fullName")} defaultValue={str(values, "fullName")} autoComplete="name" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de documento" htmlFor="docType" error={errors.docType} required>
            <select id="docType" name="docType" className={cls("docType")} defaultValue={str(values, "docType") || "CC"}>
              {DOC_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Número de documento" htmlFor="docNumber" error={errors.docNumber} required help="Lo necesitamos para transporte y seguro.">
            <input id="docNumber" name="docNumber" className={cls("docNumber")} defaultValue={str(values, "docNumber")} inputMode="numeric" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de nacimiento" htmlFor="birthDate" error={errors.birthDate}>
            <input id="birthDate" name="birthDate" type="date" className={cls("birthDate")} defaultValue={str(values, "birthDate")} />
          </Field>
          <Field label="Ciudad donde vives" htmlFor="city" error={errors.city}>
            <input id="city" name="city" className={cls("city")} defaultValue={str(values, "city")} placeholder="Medellín" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Celular / WhatsApp" htmlFor="phone" error={errors.phone} required>
            <input id="phone" name="phone" type="tel" className={cls("phone")} defaultValue={str(values, "phone")} autoComplete="tel" placeholder="300 123 4567" />
          </Field>
          <Field label="Correo electrónico" htmlFor="email" error={errors.email}>
            <input id="email" name="email" type="email" className={cls("email")} defaultValue={str(values, "email")} autoComplete="email" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grupo con el que participas" htmlFor="organizationId" error={errors.organizationId}>
            <select id="organizationId" name="organizationId" className={cls("organizationId")} defaultValue={str(values, "organizationId")}>
              <option value="">Otro / ninguno</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Si es otro grupo, ¿cuál?" htmlFor="organizationOther" error={errors.organizationOther}>
            <input id="organizationOther" name="organizationOther" className={cls("organizationOther")} defaultValue={str(values, "organizationOther")} />
          </Field>
        </div>
      </section>

      {/* 3. Salud y emergencias */}
      <section className="card space-y-4">
        <h2 className="section-title">3. Salud y emergencias</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="EPS / seguro médico" htmlFor="eps" error={errors.eps}>
            <input id="eps" name="eps" className={cls("eps")} defaultValue={str(values, "eps")} />
          </Field>
          <Field label="Tipo de sangre (RH)" htmlFor="bloodType" error={errors.bloodType}>
            <select id="bloodType" name="bloodType" className={cls("bloodType")} defaultValue={str(values, "bloodType")}>
              <option value="">Selecciona</option>
              {BLOOD_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contacto de emergencia (nombre)" htmlFor="emergencyContactName" error={errors.emergencyContactName} required>
            <input id="emergencyContactName" name="emergencyContactName" className={cls("emergencyContactName")} defaultValue={str(values, "emergencyContactName")} />
          </Field>
          <Field label="Teléfono del contacto de emergencia" htmlFor="emergencyContactPhone" error={errors.emergencyContactPhone} required>
            <input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" className={cls("emergencyContactPhone")} defaultValue={str(values, "emergencyContactPhone")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parentesco del contacto de emergencia" htmlFor="emergencyContactRelationship" error={errors.emergencyContactRelationship}>
            <input id="emergencyContactRelationship" name="emergencyContactRelationship" className={cls("emergencyContactRelationship")} defaultValue={str(values, "emergencyContactRelationship")} placeholder="Madre, esposo, hermana…" />
          </Field>
          <Field label="Segundo teléfono de emergencia" htmlFor="emergencyContactPhone2" error={errors.emergencyContactPhone2}>
            <input id="emergencyContactPhone2" name="emergencyContactPhone2" type="tel" className={cls("emergencyContactPhone2")} defaultValue={str(values, "emergencyContactPhone2")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de vacuna contra la fiebre amarilla" htmlFor="yellowFeverVaccineDate" error={errors.yellowFeverVaccineDate} help="Requisito para viajar al Chocó: mínimo 10 días antes de la salida. Si aún no la tienes, déjalo vacío.">
            <input id="yellowFeverVaccineDate" name="yellowFeverVaccineDate" type="date" className={cls("yellowFeverVaccineDate")} defaultValue={str(values, "yellowFeverVaccineDate")} />
          </Field>
          <Field label="Póliza de accidentes personales" htmlFor="accidentInsurance" error={errors.accidentInsurance} help="Aseguradora o número de póliza, si ya la tienes.">
            <input id="accidentInsurance" name="accidentInsurance" className={cls("accidentInsurance")} defaultValue={str(values, "accidentInsurance")} />
          </Field>
        </div>
        <Field label="Alergias, condiciones médicas o medicamentos" htmlFor="medicalNotes" error={errors.medicalNotes} help="Solo el equipo coordinador verá esta información.">
          <textarea id="medicalNotes" name="medicalNotes" rows={2} className={cls("medicalNotes")} defaultValue={str(values, "medicalNotes")} />
        </Field>
        <Field label="Restricciones alimentarias" htmlFor="dietaryNotes" error={errors.dietaryNotes}>
          <input id="dietaryNotes" name="dietaryNotes" className={cls("dietaryNotes")} defaultValue={str(values, "dietaryNotes")} placeholder="Ej.: vegetariano/a, sin gluten" />
        </Field>
      </section>

      {/* 4. Habilidades */}
      <section className="card space-y-4">
        <h2 className="section-title">4. Habilidades y logística</h2>
        <fieldset>
          <legend className="label">¿Qué sabes hacer? (marca todas las que apliquen)</legend>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {SKILLS.map((o) => (
              <label key={o.value} className="choice">
                <input type="checkbox" name="skills" value={o.value} defaultChecked={arr(values, "skills").includes(o.value)} className="mt-0.5" />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {errors.skills ? <p className="error">{errors.skills}</p> : null}
        </fieldset>
        <label className="choice">
          <input type="checkbox" name="constructionExperience" defaultChecked={bool(values, "constructionExperience")} className="mt-0.5" />
          <span>Tengo experiencia en obra o construcción</span>
        </label>
        <Field label="Talla de camiseta" htmlFor="shirtSize" error={errors.shirtSize}>
          <select id="shirtSize" name="shirtSize" className={cls("shirtSize")} defaultValue={str(values, "shirtSize")}>
            <option value="">Selecciona</option>
            {SHIRT_SIZES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Comentarios o preguntas" htmlFor="comments" error={errors.comments}>
          <textarea id="comments" name="comments" rows={3} className={cls("comments")} defaultValue={str(values, "comments")} />
        </Field>
      </section>

      {/* 5. Consentimiento */}
      <section className="card space-y-4">
        <label className={`choice ${errors.dataConsent ? "border-red-400" : ""}`}>
          <input type="checkbox" name="dataConsent" defaultChecked={bool(values, "dataConsent")} className="mt-0.5" />
          <span>
            Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012, únicamente para la organización,
            logística y seguridad de la misión. <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.dataConsent ? <p className="error">{errors.dataConsent}</p> : null}
        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={pending}>
          {pending ? "Enviando…" : "Enviar mi respuesta"}
        </button>
      </section>
    </form>
  );
}
