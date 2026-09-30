import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/brand";
import { MissionCover, MissionLogo } from "@/components/mission-brand";
import { AREAS, areaInfo } from "@/lib/catalogs";
import { getMissionBySlug } from "@/lib/data";
import { formatCOP, formatDateRange, formatDateTime, formatTime, formatWeekday, shortName } from "@/lib/format";
import { missionTimeline, nowBogotaTime } from "@/lib/mission-timeline";
import { currentAndNext, listAnnouncements, listItinerary, listSquads, missionDays } from "@/lib/program";
import { listCoordinators } from "@/lib/users";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ dia?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const mission = await getMissionBySlug(slug);
  return { title: mission ? `${mission.name} · En la misión` : "Misión" };
}

/** Página pública de la misión: qué está pasando y qué viene. Sin datos personales sensibles. */
export default async function MissionPublicPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { dia } = await searchParams;
  const mission = await getMissionBySlug(slug);
  if (!mission) notFound();
  const [items, avisos, squads, coordinators] = await Promise.all([listItinerary(mission.id), listAnnouncements(mission.id), listSquads(mission.id), listCoordinators()]);
  const timeline = missionTimeline(mission);
  const now = nowBogotaTime();
  const days = missionDays(mission);
  const selected = dia && days.includes(dia) ? dia : days.includes(timeline.today) ? timeline.today : days[0];
  const dayItems = items.filter((i) => i.day === selected);
  const { current, next } = currentAndNext(items, timeline.today, now);
  const dates = formatDateRange(mission.startDate, mission.endDate);

  return (
    <>
      <PublicHeader />
      <MissionCover mission={mission} />
      <main className="container-narrow flex-1 py-6 sm:py-10">
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <MissionLogo mission={mission} className="h-8" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{mission.code}</p>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{mission.name}</h1>
          <p className="mt-2 text-muted">
            <span className="font-semibold text-ink">{dates}</span>
            {mission.location ? ` · ${mission.location}` : ""}
          </p>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-900 px-3 py-1.5 text-[13px] font-semibold text-paper">
            <span className="h-[7px] w-[7px] rounded-full bg-accent-500" />
            {timeline.badge}
          </span>
        </header>

        {/* Ahora */}
        <section className="rounded-2xl bg-brand-900 p-5 text-paper sm:p-6">
          {timeline.status === "campo" ? (
            <>
              <p className="text-[13px] font-semibold text-accent-500">
                Día {timeline.dayOfMission} de {days.length} · {formatWeekday(timeline.today)}
              </p>
              {current ? (
                <p className="mt-2 text-xl font-extrabold">
                  Ahora: {current.title}
                  <span className="block text-sm font-normal text-[#cfe3db]">
                    {formatTime(current.startTime)}
                    {current.endTime ? ` – ${formatTime(current.endTime)}` : ""}
                    {current.place ? ` · ${current.place}` : ""}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-xl font-extrabold">Sin actividad programada en este momento</p>
              )}
              {next ? (
                <p className="mt-3 text-sm text-[#cfe3db]">
                  <span className="font-semibold text-paper">Siguiente:</span> {next.title} · {next.day === timeline.today ? "" : `${formatWeekday(next.day)}, `}
                  {formatTime(next.startTime)}
                  {next.place ? ` · ${next.place}` : ""}
                </p>
              ) : null}
            </>
          ) : timeline.status === "antes" ? (
            <>
              <p className="text-[13px] font-semibold text-accent-500">{timeline.badge}</p>
              <p className="mt-2 text-xl font-extrabold">Nos vemos el {formatWeekday(mission.startDate)}</p>
              <p className="mt-2 text-sm text-[#cfe3db]">
                {mission.departureNote ? `Salida: ${mission.departureNote}. ` : ""}
                {mission.meetingPoint ? `Punto de encuentro: ${mission.meetingPoint}.` : ""}
              </p>
              {next ? (
                <p className="mt-3 text-sm text-[#cfe3db]">
                  <span className="font-semibold text-paper">Primera actividad:</span> {next.title} · {formatWeekday(next.day)}, {formatTime(next.startTime)}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-accent-500">Misión finalizada</p>
              <p className="mt-2 text-xl font-extrabold">Gracias por hacer parte de esta misión.</p>
            </>
          )}
        </section>

        {/* Avisos */}
        {avisos.length > 0 ? (
          <section className="mt-8">
            <h2 className="section-title">Avisos</h2>
            <div className="mt-3 flex flex-col gap-3">
              {avisos.slice(0, 12).map((a) => (
                <article key={a.id} className={`card-tight ${a.pinned ? "border-accent-500/60 bg-accent-500/10" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15px] font-bold">
                      {a.pinned ? "📌 " : ""}
                      {a.title}
                    </span>
                    <span className="text-xs text-faint">{formatDateTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-ink-soft">{a.body}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* Programa */}
        <section className="mt-8" id="programa">
          <h2 className="section-title">Programa</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {days.map((d) => (
              <Link
                key={d}
                href={`/misiones/${mission.slug}?dia=${d}#programa`}
                className={`rounded-[10px] border px-3 py-1.5 text-sm font-semibold capitalize ${d === selected ? "border-line-strong bg-white text-ink" : "border-transparent text-muted hover:bg-white"}`}
              >
                {formatWeekday(d)}
              </Link>
            ))}
          </div>
          <div className="card mt-3">
            {dayItems.length === 0 ? <p className="text-sm text-muted">El programa de este día se publicará pronto.</p> : null}
            {dayItems.map((it) => {
              const a = it.area ? areaInfo(it.area) : null;
              const live = current?.id === it.id;
              return (
                <div key={it.id} className={`flex items-start gap-3 border-b border-line-soft py-2.5 last:border-b-0 ${live ? "-mx-2 rounded-lg bg-brand-50 px-2" : ""}`}>
                  <span className="mono w-[104px] shrink-0 pt-0.5 text-xs text-muted">
                    {formatTime(it.startTime)}
                    {it.endTime ? ` – ${formatTime(it.endTime)}` : ""}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold">
                      {it.title}
                      {live ? <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Ahora</span> : null}
                    </span>
                    <span className="text-xs text-muted">{[it.place, it.notes].filter(Boolean).join(" · ")}</span>
                  </div>
                  {a ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: a.color }}>
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: a.color }} />
                      {a.short}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* Cuadrillas */}
        {squads.length > 0 ? (
          <section className="mt-8">
            <h2 className="section-title">Cuadrillas</h2>
            <p className="mt-1 text-sm text-muted">Busca tu nombre. Tu líder es tu primer contacto durante la misión.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {squads.map((s) => {
                const a = s.area ? areaInfo(s.area) : null;
                return (
                  <article key={s.id} className="card-tight flex flex-col gap-2" data-squad-name={s.name}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-bold">{s.name}</span>
                      {a ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: a.color }}>
                          <span className="h-[7px] w-[7px] rounded-full" style={{ background: a.color }} />
                          {a.short}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm">
                      <span className="text-muted">Líder:</span> {s.leader ? shortName(s.leader.fullName) : "por definir"}
                    </p>
                    {s.meetingPoint ? (
                      <p className="text-sm">
                        <span className="text-muted">Punto de encuentro:</span> {s.meetingPoint}
                      </p>
                    ) : null}
                    {s.notes ? <p className="text-sm text-muted">{s.notes}</p> : null}
                    <p className="text-sm text-ink-soft">{s.members.map((m) => shortName(m.fullName)).join(" · ") || "Sin integrantes todavía"}</p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Logística y contactos */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="card space-y-2 text-sm">
            <h2 className="section-title">Logística</h2>
            {mission.departureNote ? (
              <p>
                <span className="text-muted">Salida:</span> {mission.departureNote}
              </p>
            ) : null}
            {mission.returnNote ? (
              <p>
                <span className="text-muted">Llegada:</span> {mission.returnNote}
              </p>
            ) : null}
            {mission.meetingPoint ? (
              <p>
                <span className="text-muted">Punto de encuentro:</span> {mission.meetingPoint}
              </p>
            ) : null}
            {mission.location ? (
              <p>
                <span className="text-muted">Lugar:</span> {mission.location}
              </p>
            ) : null}
            {mission.contributionAmount ? (
              <p>
                <span className="text-muted">Aporte por persona:</span> {formatCOP(mission.contributionAmount)}
              </p>
            ) : null}
          </div>
          <div className="card space-y-2 text-sm">
            <h2 className="section-title">Coordinación</h2>
            {AREAS.map((a) => {
              const person = coordinators.get(a.value);
              if (!person) return null;
              const wa = person.phone ? `https://wa.me/${person.phone.replace(/\D/g, "")}` : null;
              return (
                <div key={a.value} className="flex items-center justify-between gap-2 border-b border-line-soft py-1.5 last:border-b-0">
                  <span>
                    <span className="font-semibold">{person.name}</span>
                    <span className="block text-xs" style={{ color: a.color }}>
                      {a.label}
                    </span>
                  </span>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-accent px-3 py-1.5 text-xs">
                      WhatsApp
                    </a>
                  ) : null}
                </div>
              );
            })}
            {[...coordinators.values()].length === 0 ? <p className="text-muted">Los contactos de coordinación se publicarán pronto.</p> : null}
          </div>
        </section>

        {mission.registrationOpen && timeline.status === "antes" ? (
          <div className="mt-8 text-center">
            <Link href={`/misiones/${mission.slug}/confirmar`} className="btn-primary">
              Confirmar mi participación
            </Link>
          </div>
        ) : null}
      </main>
      <PublicFooter />
    </>
  );
}
