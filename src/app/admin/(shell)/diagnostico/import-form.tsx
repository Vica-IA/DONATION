"use client";

import { useActionState } from "react";
import { importCsvAction, type ImportState } from "./import-actions";

type MissionOption = { id: string; code: string; name: string; registrationOpen: boolean };

export function ImportForm({ missions }: { missions: MissionOption[] }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importCsvAction, {});
  const defaultMission = missions.find((m) => m.registrationOpen)?.id ?? missions[0]?.id ?? "";
  return (
    <form action={formAction} className="card space-y-3" encType="multipart/form-data">
      <h2 className="section-title">Importar inscripciones desde CSV</h2>
      <p className="text-sm text-muted">
        Usa el archivo que exporta el panel en Voluntarios → Descargar CSV (mismas columnas). Una persona es su documento: si ya existe se actualiza;
        si ya está inscrita en la misión no se duplica. Las fechas de registro y de aceptación de condiciones se conservan.
      </p>
      {state.error ? <div className="rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{state.error}</div> : null}
      {state.summary ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800" data-import-result>
          Filas leídas: {state.summary.total} · creadas: {state.summary.created} · actualizadas: {state.summary.updated} · condiciones registradas:{" "}
          {state.summary.acceptances} · errores: {state.summary.errors.length}
          {state.summary.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-danger">
              {state.summary.errors.slice(0, 20).map((e) => (
                <li key={e.line}>
                  Fila {e.line}: {e.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Misión</span>
          <select name="missionId" className="input" defaultValue={defaultMission}>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} · {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Archivo CSV</span>
          <input id="archivo" name="archivo" type="file" accept=".csv,text/csv" className="input" />
        </label>
      </div>
      <label className="choice">
        <input type="checkbox" name="confirm" className="mt-0.5" />
        <span>Entiendo que las personas del archivo se crearán o actualizarán en la misión elegida.</span>
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Importando…" : "Importar inscripciones"}
      </button>
    </form>
  );
}
