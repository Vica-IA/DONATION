import type { ItineraryItem } from "./db/schema";

// Cálculos puros del programa que comparten el servidor y el editor en el navegador.

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export type ItineraryConflict = { id: string; title: string; startTime: string; reason: "responsable" | "lugar"; who: string };

/**
 * Actividades del mismo día que se cruzan en horario (sin hora fin: 90 minutos) y comparten responsable o lugar.
 * No bloquea: el editor lo muestra como advertencia.
 */
export function itineraryConflicts(
  draft: { id?: string | null; day: string; startTime: string; endTime: string | null; owner: string | null; place: string | null },
  items: Pick<ItineraryItem, "id" | "day" | "startTime" | "endTime" | "title" | "owner" | "place">[],
): ItineraryConflict[] {
  const start = draft.startTime;
  const end = draft.endTime ?? addMinutes(start, 90);
  const out: ItineraryConflict[] = [];
  for (const it of items) {
    if (it.id === draft.id || it.day !== draft.day) continue;
    const itEnd = it.endTime ?? addMinutes(it.startTime, 90);
    if (!(it.startTime < end && itEnd > start)) continue;
    if (draft.owner && it.owner && draft.owner === it.owner) out.push({ id: it.id, title: it.title, startTime: it.startTime, reason: "responsable", who: it.owner });
    else if (draft.place && it.place && draft.place === it.place) out.push({ id: it.id, title: it.title, startTime: it.startTime, reason: "lugar", who: it.place });
  }
  return out;
}
