"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { AREAS, GENERAL_AREA } from "@/lib/catalogs";
import type { ItineraryItem } from "@/lib/db/schema";
import { formatWeekday } from "@/lib/format";
import { createItemAction, updateItemAction, type ItemFormState } from "./actions";

const EMPTY: ItemFormState = { errors: {}, values: {} };

export function ItemForm({ missionId, item, days, defaultDay }: { missionId: string; item?: ItineraryItem | null; days: string[]; defaultDay: string }) {
  const action = item ? updateItemAction.bind(null, missionId, item.id) : createItemAction.bind(null, missionId);
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(action, EMPTY);
  const { errors, values } = state;
  const str = (key: string, fallback = "") => (typeof values[key] === "string" ? (values[key] as string) : fallback);
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;
  const dayOptions = days.includes(item?.day ?? defaultDay) ? days : [...days, item?.day ?? defaultDay];

  return (
    <form action={formAction} className="card space-y-4" noValidate>
      <h2 className="section-title">{item ? "Editar actividad" : "Agregar actividad"}</h2>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {state.saved ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">{item ? "Cambios guardados." : "Actividad agregada al programa."}</div> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Día" htmlFor="day" error={errors.day} required>
          <select id="day" name="day" className={cls("day")} defaultValue={str("day", item?.day ?? defaultDay)}>
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {formatWeekday(d)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hora de inicio" htmlFor="startTime" error={errors.startTime} required>
          <input id="startTime" name="startTime" type="time" className={cls("startTime")} defaultValue={str("startTime", item?.startTime ?? "")} />
        </Field>
        <Field label="Hora de fin" htmlFor="endTime" error={errors.endTime} help="Opcional.">
          <input id="endTime" name="endTime" type="time" className={cls("endTime")} defaultValue={str("endTime", item?.endTime ?? "")} />
        </Field>
      </div>
      <Field label="Actividad" htmlFor="title" error={errors.title} required>
        <input id="title" name="title" className={cls("title")} defaultValue={str("title", item?.title ?? "")} placeholder="Ej. Desayuno y oración de la mañana" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lugar" htmlFor="place" error={errors.place}>
          <input id="place" name="place" className={cls("place")} defaultValue={str("place", item?.place ?? "")} placeholder="Ej. Institución educativa" />
        </Field>
        <Field label="Área responsable" htmlFor="area" error={errors.area}>
          <select id="area" name="area" className={cls("area")} defaultValue={str("area", item?.area ?? "")}>
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
      <Field label="Notas" htmlFor="notes" error={errors.notes} help="Se muestran a todos en la página pública.">
        <input id="notes" name="notes" className={cls("notes")} defaultValue={str("notes", item?.notes ?? "")} />
      </Field>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : item ? "Guardar cambios" : "Agregar al programa"}
      </button>
    </form>
  );
}
