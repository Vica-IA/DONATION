"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { AREAS, GENERAL_AREA, TASK_STATUS, type Area } from "@/lib/catalogs";
import type { TaskRow } from "@/lib/tasks";
import { createTaskAction, updateTaskAction, type TaskFormState } from "./actions";

type Person = { id: string; name: string; label: string };

type Props = {
  missionId: string;
  task?: TaskRow | null;
  people: Person[];
  /** Áreas permitidas para el usuario ("all" o lista). */
  areas: "all" | Area[];
  defaultArea?: string;
  compact?: boolean;
};

const EMPTY: TaskFormState = { errors: {}, values: {} };

export function TaskForm({ missionId, task, people, areas, defaultArea, compact = false }: Props) {
  const action = task ? updateTaskAction.bind(null, missionId, task.id) : createTaskAction.bind(null, missionId);
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(action, EMPTY);
  const { errors, values } = state;
  const str = (key: string, fallback = "") => (typeof values[key] === "string" ? (values[key] as string) : fallback);
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;
  const areaOptions = [...AREAS.filter((a) => areas === "all" || areas.includes(a.value)), ...(areas === "all" ? [GENERAL_AREA] : [])];
  const goDefault = values.isGoCriteria !== undefined ? values.isGoCriteria === true : (task?.isGoCriteria ?? false);

  return (
    <form action={formAction} className={`${compact ? "card-tight" : "card"} space-y-4`} noValidate>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {state.saved && task ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">Cambios guardados.</div> : null}
      {state.saved && !task ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">Tarea creada.</div> : null}
      <Field label="Tarea" htmlFor="title" error={errors.title} required>
        <input id="title" name="title" className={cls("title")} defaultValue={str("title", task?.title ?? "")} placeholder="Ej. Confirmar alojamiento del equipo" />
      </Field>
      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <Field label="Área" htmlFor="area" error={errors.area} required>
          <select id="area" name="area" className={cls("area")} defaultValue={str("area", task?.area ?? defaultArea ?? areaOptions[0]?.value ?? "general")}>
            {areaOptions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsable" htmlFor="ownerUserId" error={errors.ownerUserId}>
          <select id="ownerUserId" name="ownerUserId" className={cls("ownerUserId")} defaultValue={str("ownerUserId", task?.ownerUserId ?? "")}>
            <option value="">Coordinación del área</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha límite" htmlFor="dueDate" error={errors.dueDate}>
          <input id="dueDate" name="dueDate" type="date" className={cls("dueDate")} defaultValue={str("dueDate", task?.dueDate ?? "")} />
        </Field>
      </div>
      {!compact ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estado" htmlFor="status" error={errors.status}>
            <select id="status" name="status" className={cls("status")} defaultValue={str("status", task?.status ?? "pendiente")}>
              {TASK_STATUS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notas" htmlFor="notes" error={errors.notes}>
            <input id="notes" name="notes" className={cls("notes")} defaultValue={str("notes", task?.notes ?? "")} />
          </Field>
        </div>
      ) : (
        <input type="hidden" name="status" value="pendiente" />
      )}
      <label className="choice">
        <input type="checkbox" name="isGoCriteria" defaultChecked={goDefault} className="mt-0.5" />
        <span>
          Criterio Go / No-Go
          <span className="block text-xs text-muted">Debe estar hecha antes del despliegue; aparece en el resumen de la misión.</span>
        </span>
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : task ? "Guardar cambios" : "Crear tarea"}
        </button>
      </div>
    </form>
  );
}
