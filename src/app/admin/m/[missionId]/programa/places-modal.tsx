"use client";

import { useActionState } from "react";
import { Modal } from "@/components/modal";
import { PLACE_TYPES, labelOf } from "@/lib/catalogs";
import { createPlaceAction, deletePlaceAction, type EditorState } from "./actions";

export type PlaceRow = { id: string; name: string; type: string; uses: number };

const EMPTY: EditorState = { errors: {}, values: {} };

/** Lista de lugares de la misión: quitar los que no se usan y agregar nuevos. */
export function PlacesModal({ missionId, returnTo, closeHref, places }: { missionId: string; returnTo: string; closeHref: string; places: PlaceRow[] }) {
  const [state, formAction, pending] = useActionState<EditorState, FormData>(createPlaceAction.bind(null, missionId), EMPTY);
  const str = (key: string, fallback = "") => (typeof state.values[key] === "string" ? (state.values[key] as string) : fallback);

  return (
    <Modal kicker="Configuración de la misión" title="Lugares" closeHref={closeHref}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-2 sm:px-6" data-places>
        <p className="py-2 text-[13px] text-muted">Disponibles al crear o editar actividades. Un lugar en uso no se puede quitar.</p>
        {places.length === 0 ? <p className="py-3 text-sm text-muted">Aún no hay lugares.</p> : null}
        {places.map((pl) => (
          <div key={pl.id} className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0" data-place={pl.name}>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{pl.name}</span>
              <span className="text-xs text-muted">
                {labelOf(PLACE_TYPES, pl.type)} · {pl.uses} {pl.uses === 1 ? "actividad" : "actividades"}
              </span>
            </div>
            {pl.uses > 0 ? (
              <span className="px-2 py-1.5 text-[13px] font-semibold text-faint">En uso</span>
            ) : (
              <form action={deletePlaceAction.bind(null, missionId, pl.id)}>
                <input type="hidden" name="returnTo" value={returnTo} />
                <button type="submit" className="rounded-lg px-2 py-1.5 text-[13px] font-semibold text-danger hover:bg-danger-soft">
                  Quitar
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
      <form action={formAction} noValidate className="flex flex-col gap-2 border-t border-line px-5 py-4 sm:px-6">
        <input type="hidden" name="returnTo" value={returnTo} />
        {state.errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.errors._form}</div> : null}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
          <input id="placeName" name="name" className={`input${state.errors.name ? " input-error" : ""}`} defaultValue={str("name")} placeholder="Nuevo lugar" aria-label="Nuevo lugar" />
          <select id="placeType" name="type" className="input" defaultValue={str("type", "obra")} aria-label="Tipo de lugar">
            {PLACE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Guardando…" : "Agregar"}
          </button>
        </div>
        {state.errors.name ? <p className="error">{state.errors.name}</p> : null}
      </form>
    </Modal>
  );
}
