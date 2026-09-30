"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import type { Announcement } from "@/lib/db/schema";
import { createAnnouncementAction, updateAnnouncementAction, type AnnouncementFormState } from "./actions";

const EMPTY: AnnouncementFormState = { errors: {}, values: {} };

export function AnnouncementForm({ missionId, announcement }: { missionId: string; announcement?: Announcement | null }) {
  const action = announcement ? updateAnnouncementAction.bind(null, missionId, announcement.id) : createAnnouncementAction.bind(null, missionId);
  const [state, formAction, pending] = useActionState<AnnouncementFormState, FormData>(action, EMPTY);
  const { errors, values } = state;
  const str = (key: string, fallback = "") => (typeof values[key] === "string" ? (values[key] as string) : fallback);
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;
  const pinnedDefault = values.pinned !== undefined ? values.pinned === true : (announcement?.pinned ?? false);

  return (
    <form action={formAction} className="card space-y-4" noValidate>
      <h2 className="section-title">{announcement ? "Editar aviso" : "Publicar un aviso"}</h2>
      <p className="text-sm text-muted">Se muestra de inmediato en la página pública de la misión, con la hora de publicación.</p>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {state.saved ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">{announcement ? "Cambios guardados." : "Aviso publicado."}</div> : null}
      <Field label="Título" htmlFor="title" error={errors.title} required>
        <input id="title" name="title" className={cls("title")} defaultValue={str("title", announcement?.title ?? "")} placeholder="Ej. Cambio de hora de salida" />
      </Field>
      <Field label="Aviso" htmlFor="body" error={errors.body} required>
        <textarea id="body" name="body" rows={4} className={cls("body")} defaultValue={str("body", announcement?.body ?? "")} />
      </Field>
      <label className="choice">
        <input type="checkbox" name="pinned" defaultChecked={pinnedDefault} className="mt-0.5" />
        <span>
          Fijar arriba
          <span className="block text-xs text-muted">Se mantiene primero aunque publiquen avisos nuevos (reglas, contactos de emergencia…).</span>
        </span>
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : announcement ? "Guardar cambios" : "Publicar aviso"}
      </button>
    </form>
  );
}
