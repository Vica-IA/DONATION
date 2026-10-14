"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { Seg } from "@/components/seg";
import { TEAM_ALL } from "@/lib/catalogs";
import { formatDayShort, formatTime, formatWeekdayCap } from "@/lib/format";
import { itineraryConflicts } from "@/lib/program-shared";
import { deleteItemAction, duplicateItemAction, saveItemAction, type EditorState } from "./actions";

export type AreaOption = { value: string; label: string; short: string; color: string };
export type PersonOption = { value: string; label: string };
export type PlaceOption = { name: string; type: string };
export type TeamOption = { value: string; label: string; sub: string; count: number };
export type OtherItem = { id: string; day: string; startTime: string; endTime: string | null; title: string; owner: string | null; place: string | null };

export type EditorItem = {
  id: string;
  day: string;
  startTime: string;
  endTime: string | null;
  title: string;
  place: string | null;
  area: string | null;
  owner: string | null;
  teams: string[];
  notes: string | null;
  notify: boolean;
  visible: boolean;
};

export type EditorProps = {
  missionId: string;
  returnTo: string;
  closeHref: string;
  placesHref: string;
  item: EditorItem | null;
  days: string[];
  defaultDay: string;
  defaultArea: string;
  areas: AreaOption[];
  people: PersonOption[];
  /** Coordinador de cada área, para proponerlo como responsable al elegir el área. */
  areaOwner: Record<string, string>;
  places: PlaceOption[];
  teams: TeamOption[];
  confirmed: number;
  others: OtherItem[];
};

const EMPTY: EditorState = { errors: {}, values: {} };

function Toggle({ name, label, sub, defaultChecked }: { name: string; label: string; sub: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-line-soft py-3 last:border-b-0">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted">{sub}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="flex h-6 w-10 shrink-0 rounded-full bg-line-strong p-[3px] transition-colors peer-checked:justify-end peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300">
        <span className="h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)]" />
      </span>
    </label>
  );
}

/** Editor lateral de una actividad (nueva o existente). Guarda con una acción de servidor y vuelve al día de la actividad. */
export function ActivityEditor(p: EditorProps) {
  const { item } = p;
  const action = saveItemAction.bind(null, p.missionId, item?.id ?? "");
  const [state, formAction, pending] = useActionState<EditorState, FormData>(action, EMPTY);
  const { errors, values } = state;
  const str = (key: string, fallback = "") => (typeof values[key] === "string" ? (values[key] as string) : fallback);
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;
  /** Hubo un envío con errores: las casillas reflejan lo enviado (ausente = apagada). */
  const submitted = typeof values.returnTo === "string";

  const initialDay = str("day", item?.day ?? p.defaultDay);
  const initialArea = str("area", item?.area ?? p.defaultArea);
  const initialOwner = str("owner", item?.owner ?? (item ? "" : (p.areaOwner[initialArea] ?? "")));
  const initialPlace = str("place", item?.place ?? "");
  const initialTeams = Array.isArray(values.teams) ? (values.teams as string[]) : (item?.teams ?? [TEAM_ALL]);

  const [day, setDay] = useState(initialDay);
  const [startTime, setStartTime] = useState(str("startTime", item?.startTime ?? "08:00"));
  const [endTime, setEndTime] = useState(str("endTime", item?.endTime ?? (item ? "" : "09:00")));
  const [area, setArea] = useState(initialArea);
  const [owner, setOwner] = useState(initialOwner);
  const [place, setPlace] = useState(initialPlace);
  const [teams, setTeams] = useState<string[]>(initialTeams);
  const [title, setTitle] = useState(str("title", item?.title ?? ""));
  const ownerRef = useRef<HTMLSelectElement>(null);

  const dayOptions = useMemo(() => {
    const list = p.days.includes(initialDay) ? p.days : [...p.days, initialDay];
    return list.map((d) => ({ value: d, label: formatDayShort(d) }));
  }, [p.days, initialDay]);
  const people = useMemo(() => (owner && !p.people.some((x) => x.value === owner) ? [{ value: owner, label: owner }, ...p.people] : p.people), [p.people, owner]);
  const places = useMemo(() => (initialPlace && !p.places.some((x) => x.name === initialPlace) ? [{ name: initialPlace, type: "otro" }, ...p.places] : p.places), [p.places, initialPlace]);
  const headcount = teams.includes(TEAM_ALL) ? p.confirmed : teams.reduce((s, t) => s + (p.teams.find((x) => x.value === t)?.count ?? 0), 0);
  const conflicts = /^\d{2}:\d{2}$/.test(startTime)
    ? itineraryConflicts({ id: item?.id ?? null, day, startTime, endTime: /^\d{2}:\d{2}$/.test(endTime) ? endTime : null, owner: owner || null, place: place || null }, p.others)
    : [];
  const areaColor = p.areas.find((a) => a.value === area)?.color ?? "#157a5e";

  function pickArea(value: string) {
    setArea(value);
    const suggested = p.areaOwner[value];
    if (suggested && people.some((x) => x.value === suggested)) {
      setOwner(suggested);
      if (ownerRef.current) ownerRef.current.value = suggested;
    }
  }

  function toggleTeam(value: string) {
    setTeams((prev) => {
      const on = prev.includes(value);
      let next = on ? prev.filter((x) => x !== value) : value === TEAM_ALL ? [TEAM_ALL] : [...prev.filter((x) => x !== TEAM_ALL), value];
      if (next.length === 0) next = [TEAM_ALL];
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={item ? "Editar actividad" : "Nueva actividad"}>
      <Link href={p.closeHref} className="absolute inset-0 bg-ink/40" aria-label="Cerrar" />
      <div className="relative flex h-full w-[520px] max-w-full flex-col bg-paper shadow-[-20px_0_60px_-20px_rgba(16,35,29,.4)]" data-editor>
        <div className="flex items-start justify-between gap-3 border-b border-line bg-white px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold" style={{ color: areaColor }}>
              {item ? `Editar actividad · ${formatWeekdayCap(item.day)}` : "Nueva actividad"}
            </span>
            <span className="truncate text-[22px] font-extrabold tracking-[-0.02em]">{title.trim() || (item ? "Actividad sin nombre" : "Crear actividad")}</span>
          </div>
          <Link href={p.closeHref} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-line-soft">
            Cerrar
          </Link>
        </div>

        <form id="activity-form" action={formAction} noValidate className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">
          <input type="hidden" name="returnTo" value={p.returnTo} />
          <input type="hidden" name="area" value={area} />
          {teams.map((t) => (
            <input key={t} type="hidden" name="teams" value={t} />
          ))}
          {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="text-[13px] font-semibold">
              Nombre de la actividad <span className="text-red-500">*</span>
            </label>
            <input id="title" name="title" className={cls("title")} defaultValue={str("title", item?.title ?? "")} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Entrega de mercados" />
            {errors.title ? <p className="error">{errors.title}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold">Día</span>
            <Seg name="day" options={dayOptions} initial={initialDay} onChange={setDay} cols={Math.min(dayOptions.length, 4)} />
            {errors.day ? <p className="error">{errors.day}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="startTime" className="text-[13px] font-semibold">
                Inicio
              </label>
              <input id="startTime" name="startTime" type="time" className={`${cls("startTime")} mono`} defaultValue={str("startTime", item?.startTime ?? "08:00")} onChange={(e) => setStartTime(e.target.value)} />
              {errors.startTime ? <p className="error">{errors.startTime}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="endTime" className="text-[13px] font-semibold">
                Fin <span className="font-normal text-faint">(opcional)</span>
              </label>
              <input id="endTime" name="endTime" type="time" className={`${cls("endTime")} mono`} defaultValue={str("endTime", item?.endTime ?? (item ? "" : "09:00"))} onChange={(e) => setEndTime(e.target.value)} />
              {errors.endTime ? <p className="error">{errors.endTime}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold">Área que coordina</span>
            <div className="flex flex-wrap gap-1.5">
              {p.areas.map((a) => {
                const on = a.value === area;
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => pickArea(a.value)}
                    aria-pressed={on}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold"
                    style={on ? { background: a.color, borderColor: a.color, color: "#fff" } : { background: "#fff", borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                  >
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? "#fff" : a.color }} />
                    {a.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="owner" className="text-[13px] font-semibold">
              Responsable
            </label>
            <select id="owner" name="owner" ref={ownerRef} className={cls("owner")} defaultValue={initialOwner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Sin responsable</option>
              {people.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <p className="help">Por defecto, el coordinador del área. Puede delegarse en un líder de cuadrilla.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="place" className="text-[13px] font-semibold">
                Lugar
              </label>
              <Link href={p.placesHref} className="text-[13px] font-semibold text-brand-600 hover:text-brand-700">
                Configurar lugares
              </Link>
            </div>
            <select id="place" name="place" className={cls("place")} defaultValue={initialPlace} onChange={(e) => setPlace(e.target.value)}>
              <option value="">Sin lugar</option>
              {places.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name}
                </option>
              ))}
            </select>
            {places.length === 0 ? <p className="help">Aún no hay lugares: agrégalos en &ldquo;Configurar lugares&rdquo;.</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">Cuadrillas asignadas</span>
              <span className="text-xs text-muted" data-headcount={headcount}>
                ≈ {headcount} personas
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.teams.map((t) => {
                const on = teams.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleTeam(t.value)}
                    aria-pressed={on}
                    data-team={t.label}
                    className={`flex flex-col items-start gap-px rounded-xl border px-3 py-2 text-left ${on ? "border-brand-900 bg-brand-900 text-white" : "border-line bg-white text-ink"}`}
                  >
                    <span className="text-[13px] font-bold">{t.label}</span>
                    <span className="text-[11px] opacity-75">{t.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-[13px] font-semibold">
              Indicaciones para los asignados
            </label>
            <textarea id="notes" name="notes" className={`${cls("notes")} min-h-[84px] resize-y`} defaultValue={str("notes", item?.notes ?? "")} placeholder="Qué llevar, punto exacto, observaciones…" />
            {errors.notes ? <p className="error">{errors.notes}</p> : null}
          </div>

          <div className="rounded-[14px] border border-line bg-white px-3.5 py-1">
            <Toggle name="notify" label="Avisar a los asignados" sub="Al guardar queda listo un mensaje de WhatsApp con la actividad" defaultChecked={submitted ? values.notify === "on" : (item?.notify ?? true)} />
            <Toggle name="visible" label="Mostrar en la página pública" sub="Aparece en el programa que ven los voluntarios" defaultChecked={submitted ? values.visible === "on" : (item?.visible ?? true)} />
          </div>

          {conflicts.length > 0 ? (
            <div className="flex flex-col gap-1.5 rounded-[14px] bg-warn-soft p-3.5 text-warn" data-conflicts>
              <span className="text-sm font-extrabold">Posible cruce de horario</span>
              {conflicts.map((c) => (
                <span key={c.id} className="text-[13px] leading-snug">
                  {formatTime(c.startTime)} · {c.title} — {c.reason === "responsable" ? `mismo responsable (${c.who})` : `mismo lugar (${c.who})`}
                </span>
              ))}
            </div>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white px-4 py-3 sm:px-6 sm:py-4">
          {item ? (
            <div className="mr-auto flex items-center gap-1">
              <form action={deleteItemAction.bind(null, p.missionId, item.id)} onSubmit={(e) => (window.confirm("¿Eliminar esta actividad del programa?") ? undefined : e.preventDefault())}>
                <input type="hidden" name="returnTo" value={p.returnTo} />
                <button type="submit" className="rounded-[10px] px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft">
                  Eliminar
                </button>
              </form>
              <form action={duplicateItemAction.bind(null, p.missionId, item.id)}>
                <input type="hidden" name="returnTo" value={p.returnTo} />
                <button type="submit" className="rounded-[10px] px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-line-soft">
                  Duplicar
                </button>
              </form>
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Link href={p.closeHref} className="btn-secondary">
              Cancelar
            </Link>
            <button type="submit" form="activity-form" className="btn-primary whitespace-nowrap" disabled={pending}>
              {pending ? "Guardando…" : item ? "Guardar cambios" : "Crear actividad"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
