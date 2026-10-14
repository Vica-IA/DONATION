import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { AREAS, GENERAL_AREA, TEAM_ALL, TEAM_COORD, areaInfo, parseTeams } from "@/lib/catalogs";
import { siteUrl } from "@/lib/config";
import { getMissionById, getMissionStats } from "@/lib/data";
import type { ItineraryItem } from "@/lib/db/schema";
import { formatTime, formatWeekday, formatWeekdayCap, toQuery } from "@/lib/format";
import { todayBogota } from "@/lib/mission-timeline";
import { can } from "@/lib/permissions";
import { listItinerary, listPlaces, listSquads, missionDays, placeUses } from "@/lib/program";
import { listUsers } from "@/lib/users";
import { ActivityEditor, type AreaOption, type PersonOption, type TeamOption } from "./activity-editor";
import { PlacesModal } from "./places-modal";

export const metadata = { title: "Programa" };

type Params = { missionId: string };
type Search = { dia?: string; area?: string; editar?: string; lugares?: string; msg?: string; avisar?: string };

const AREA_OPTIONS: AreaOption[] = [...AREAS, GENERAL_AREA].map((a) => ({ value: a.value, label: a.label, short: a.short, color: a.color }));
const COLS = "lg:grid-cols-[120px_minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_60px]";

export default async function ProgramPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { missionId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/admin/m/${missionId}/programa`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const manage = can(user.role, "program.manage");
  const [items, squads, places, uses, users, stats] = await Promise.all([listItinerary(mission.id), listSquads(mission.id), listPlaces(mission.id), placeUses(mission.id), listUsers(), getMissionStats(mission)]);
  const days = missionDays(mission);
  const today = todayBogota();
  const selected = sp.dia && days.includes(sp.dia) ? sp.dia : days.includes(today) ? today : days[0];
  const areaFilter = sp.area && AREA_OPTIONS.some((a) => a.value === sp.area) ? sp.area : "";
  const dayItems = items.filter((i) => i.day === selected && (!areaFilter || i.area === areaFilter));
  const hidden = items.filter((i) => !i.visible).length;
  const base = `/admin/m/${mission.id}`;
  const view = `${base}/programa${toQuery({ dia: selected, area: areaFilter })}`;
  const href = (extra: Record<string, string | undefined>) => `${base}/programa${toQuery({ dia: selected, area: areaFilter, ...extra })}`;

  // Quién puede ser responsable: coordinación activa del panel y líderes de cuadrilla.
  const people: PersonOption[] = [];
  const areaOwner: Record<string, string> = {};
  let coordCount = 0;
  for (const u of users) {
    if (!u.active) continue;
    if (u.role === "coordinador" && u.area) {
      coordCount += 1;
      people.push({ value: u.name, label: `${u.name} · ${areaInfo(u.area).short}` });
      if (!areaOwner[u.area]) areaOwner[u.area] = u.name;
    } else if (u.role === "admin" || u.role === "lider_grupo") {
      coordCount += 1;
      people.push({ value: u.name, label: `${u.name} · ${u.role === "admin" ? "Dirección" : "Líder de grupo"}` });
      if (u.role === "admin" && !areaOwner[GENERAL_AREA.value]) areaOwner[GENERAL_AREA.value] = u.name;
    }
  }
  for (const s of squads) if (s.leader) people.push({ value: s.leader.fullName, label: `${s.leader.fullName} · Líder ${s.name}` });
  const seen = new Set<string>();
  const peopleUnique = people.filter((p) => (seen.has(p.value) ? false : (seen.add(p.value), true)));

  const teamOptions: TeamOption[] = [
    { value: TEAM_ALL, label: "Todos", sub: "Toda la misión", count: stats.byStatus.confirmado },
    { value: TEAM_COORD, label: "Coordinadores", sub: "Dirección y áreas", count: coordCount },
    ...squads.map((s) => ({ value: s.id, label: s.name, sub: s.area ? areaInfo(s.area).short : "Sin área", count: s.members.length })),
  ];
  const teamLabel = new Map(teamOptions.map((t) => [t.value, t.label]));
  const teamsOf = (it: ItineraryItem) => parseTeams(it.teams).map((t) => teamLabel.get(t)).filter((x): x is string => Boolean(x));

  const editing = manage && sp.editar ? (sp.editar === "nueva" ? null : (items.find((i) => i.id === sp.editar) ?? undefined)) : undefined;
  const editorOpen = manage && Boolean(sp.editar) && editing !== undefined;
  const placesOpen = manage && sp.lugares === "1";
  const notify = sp.avisar ? items.find((i) => i.id === sp.avisar) : null;
  const waText = notify
    ? encodeURIComponent(
        [
          `${mission.name} · ${formatWeekday(notify.day)}, ${formatTime(notify.startTime)}${notify.endTime ? ` – ${formatTime(notify.endTime)}` : ""}`,
          notify.title,
          notify.place ? `Lugar: ${notify.place}` : "",
          notify.owner ? `Responsable: ${notify.owner}` : "",
          `Para: ${teamsOf(notify).join(", ") || "Todos"}`,
          notify.notes ?? "",
          `Programa: ${siteUrl()}/misiones/${mission.slug}?dia=${notify.day}#programa`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
    : "";

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Programa de campo"
        badge={
          <span className="text-xs text-muted">
            {items.length} actividades{hidden > 0 ? ` · ${hidden} ocultas al público` : " · visibles en la página pública"}
          </span>
        }
        actions={
          <a href={`/misiones/${mission.slug}`} className="btn-secondary" target="_blank" rel="noopener noreferrer">
            Ver página pública
          </a>
        }
      />
      <PageBody>
        {sp.msg ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800" data-flash>
            <span>{sp.msg}</span>
            {notify ? (
              <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer" className="btn-accent !py-1.5 text-[13px]">
                Avisar por WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => {
            const on = d === selected;
            const n = items.filter((i) => i.day === d).length;
            return (
              <Link
                key={d}
                href={`${base}/programa${toQuery({ dia: d, area: areaFilter })}`}
                className={`inline-flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-sm font-semibold ${on ? "border-line-strong bg-white text-ink" : "border-transparent text-muted hover:bg-white"}`}
              >
                {formatWeekdayCap(d)}
                <span className="mono text-[11px] text-faint">{n}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted">Área:</span>
            {[{ value: "", short: "Todas", color: "#8a958f" }, ...AREA_OPTIONS].map((a) => {
              const on = a.value === areaFilter;
              return (
                <Link
                  key={a.value || "todas"}
                  href={`${base}/programa${toQuery({ dia: selected, area: a.value })}`}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[13px] font-semibold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-paper-2"}`}
                >
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: a.color }} />
                  {a.short}
                </Link>
              );
            })}
          </div>
          {manage ? (
            <div className="flex flex-1 gap-2 sm:flex-none">
              <Link href={href({ lugares: "1" })} className="btn-secondary flex-1 justify-center sm:flex-none">
                Configurar lugares
              </Link>
              <Link href={href({ editar: "nueva" })} className="btn-primary flex-1 justify-center sm:flex-none">
                + Nueva actividad
              </Link>
            </div>
          ) : null}
        </div>

        <section className="overflow-hidden rounded-2xl border border-line bg-white" data-day={selected}>
          <div className="border-b border-line px-4 py-3.5 text-[17px] font-extrabold sm:px-[18px]">{formatWeekdayCap(selected)}</div>
          <div className={`hidden gap-3 border-b border-line bg-paper-2 px-[18px] py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted lg:grid ${COLS}`}>
            <span>Hora</span>
            <span>Actividad</span>
            <span>Lugar</span>
            <span>Área · Responsable</span>
            <span>Cuadrillas</span>
            <span />
          </div>
          {dayItems.length === 0 ? <p className="px-4 py-7 text-center text-sm text-faint">Sin actividades este día{areaFilter ? " para esta área" : ""}.</p> : null}
          {dayItems.map((it) => {
            const a = it.area ? areaInfo(it.area) : null;
            const teams = teamsOf(it);
            const editHref = href({ editar: it.id });
            return (
              <div key={it.id} className={`grid grid-cols-[84px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-line-soft px-4 py-3 text-sm last:border-b-0 hover:bg-paper-2 sm:px-[18px] lg:gap-3 ${COLS}`} data-item-title={it.title}>
                <span className="mono pt-0.5 text-xs font-semibold">
                  {formatTime(it.startTime)}
                  {it.endTime ? (
                    <>
                      <br className="lg:hidden" />
                      <span className="hidden lg:inline"> – </span>
                      <span className="text-faint lg:text-ink">{formatTime(it.endTime)}</span>
                    </>
                  ) : null}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-bold">
                    {manage ? (
                      <Link href={editHref} className="hover:text-brand-700">
                        {it.title}
                      </Link>
                    ) : (
                      it.title
                    )}
                    {!it.visible ? <span className="rounded-md bg-sand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Oculta</span> : null}
                  </span>
                  {it.notes ? <span className="text-xs text-muted">{it.notes}</span> : null}
                </div>
                <span className="col-start-2 text-xs text-ink-soft lg:col-start-auto lg:text-sm">{it.place ?? <span className="text-faint">—</span>}</span>
                <div className="col-start-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 lg:col-start-auto lg:flex-col lg:items-start">
                  {a ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: a.color }}>
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: a.color }} />
                      {a.short}
                    </span>
                  ) : (
                    <span className="text-xs text-faint">Sin área</span>
                  )}
                  {it.owner ? <span className="text-xs text-muted">{it.owner}</span> : null}
                </div>
                <div className="col-start-2 flex flex-wrap gap-1 lg:col-start-auto">
                  {teams.map((t) => (
                    <span key={t} className="rounded-md bg-line-soft px-2 py-0.5 text-xs font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
                {manage ? (
                  <Link href={editHref} className="col-start-2 justify-self-start text-[13px] font-semibold text-brand-700 lg:col-start-auto lg:justify-self-end">
                    Editar
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </section>

        {editorOpen ? (
          <ActivityEditor
            missionId={mission.id}
            returnTo={view}
            closeHref={view}
            placesHref={href({ editar: sp.editar, lugares: "1" })}
            item={editing ? { ...editing, teams: parseTeams(editing.teams) } : null}
            days={days}
            defaultDay={selected}
            defaultArea={areaFilter || AREAS[0].value}
            areas={AREA_OPTIONS}
            people={peopleUnique}
            areaOwner={areaOwner}
            places={places.map((pl) => ({ name: pl.name, type: pl.type }))}
            teams={teamOptions}
            confirmed={stats.byStatus.confirmado}
            others={items.map((i) => ({ id: i.id, day: i.day, startTime: i.startTime, endTime: i.endTime, title: i.title, owner: i.owner, place: i.place }))}
          />
        ) : null}
        {placesOpen ? (
          <PlacesModal
            missionId={mission.id}
            returnTo={href({ editar: editorOpen ? sp.editar : undefined, lugares: "1" })}
            closeHref={href({ editar: editorOpen ? sp.editar : undefined })}
            places={places.map((pl) => ({ id: pl.id, name: pl.name, type: pl.type, uses: uses.get(pl.name) ?? 0 }))}
          />
        ) : null}
      </PageBody>
    </>
  );
}
