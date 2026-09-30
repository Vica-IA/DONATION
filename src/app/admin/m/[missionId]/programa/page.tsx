import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { areaInfo } from "@/lib/catalogs";
import { getMissionById } from "@/lib/data";
import { formatTime, formatWeekday } from "@/lib/format";
import { todayBogota } from "@/lib/mission-timeline";
import { can } from "@/lib/permissions";
import { listItinerary, missionDays } from "@/lib/program";
import { ItemForm } from "./item-form";

export const metadata = { title: "Programa" };

export default async function ProgramPage({ params, searchParams }: { params: Promise<{ missionId: string }>; searchParams: Promise<{ dia?: string }> }) {
  const { missionId } = await params;
  const { dia } = await searchParams;
  const user = await requireUser(`/admin/m/${missionId}/programa`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const manage = can(user.role, "program.manage");
  const items = await listItinerary(mission.id);
  const days = missionDays(mission);
  const today = todayBogota();
  const selected = dia && days.includes(dia) ? dia : days.includes(today) ? today : days[0];
  const dayItems = items.filter((i) => i.day === selected);
  const base = `/admin/m/${mission.id}`;

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Programa de la misión"
        badge={<span className="text-xs text-muted">{items.length} actividades · visible en la página pública</span>}
        actions={
          <a href={`/misiones/${mission.slug}`} className="btn-secondary" target="_blank" rel="noopener noreferrer">
            Ver página pública
          </a>
        }
      />
      <PageBody>
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => {
            const on = d === selected;
            const n = items.filter((i) => i.day === d).length;
            return (
              <Link
                key={d}
                href={`${base}/programa?dia=${d}`}
                className={`inline-flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-sm font-semibold capitalize ${on ? "border-line-strong bg-white text-ink" : "border-transparent text-muted hover:bg-white"}`}
              >
                {formatWeekday(d)}
                <span className="mono text-[11px] text-faint">{n}</span>
              </Link>
            );
          })}
        </div>

        <section className="card-tight flex flex-col gap-1 sm:p-5">
          <span className="section-title capitalize">{formatWeekday(selected)}</span>
          {dayItems.length === 0 ? <p className="py-2 text-sm text-muted">Sin actividades este día.</p> : null}
          {dayItems.map((it) => {
            const a = it.area ? areaInfo(it.area) : null;
            return (
              <div key={it.id} className="flex items-start gap-3 border-b border-line-soft py-2.5" data-item-title={it.title}>
                <span className="mono w-28 shrink-0 pt-0.5 text-xs text-muted">
                  {formatTime(it.startTime)}
                  {it.endTime ? ` – ${formatTime(it.endTime)}` : ""}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  {manage ? (
                    <Link href={`${base}/programa/${it.id}`} className="text-sm font-semibold hover:text-brand-700">
                      {it.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold">{it.title}</span>
                  )}
                  <span className="text-xs text-muted">
                    {[it.place, it.notes].filter(Boolean).join(" · ")}
                  </span>
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
        </section>

        {manage ? <ItemForm missionId={mission.id} days={days} defaultDay={selected} /> : null}
      </PageBody>
    </>
  );
}
