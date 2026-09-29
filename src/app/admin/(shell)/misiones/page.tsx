import Link from "next/link";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { Progress } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MISSION_STATUS, labelOf } from "@/lib/catalogs";
import { getMissionStats, listMissions } from "@/lib/data";
import { formatDateRange, percent } from "@/lib/format";
import { missionTimeline } from "@/lib/mission-timeline";
import { can } from "@/lib/permissions";

export const metadata = { title: "Misiones" };

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ denegado?: string }> }) {
  const user = await requireUser("/admin/misiones");
  const { denegado } = await searchParams;
  const missions = await listMissions();
  const stats = await Promise.all(missions.map((m) => getMissionStats(m)));
  const canManage = can(user.role, "missions.manage");

  return (
    <>
      <PageHeader
        title="Misiones"
        kicker="Todas las misiones"
        actions={
          canManage ? (
            <Link href="/admin/misiones/nueva" className="btn-primary">
              + Nueva misión
            </Link>
          ) : null
        }
      />
      <PageBody>
        {denegado ? (
          <div className="rounded-xl border border-amber-200 bg-warn-soft p-3 text-sm text-warn" role="alert">
            No tienes permiso para esa acción.
          </div>
        ) : null}
        {missions.length === 0 ? <p className="card text-sm text-muted">Todavía no hay misiones. {canManage ? "Crea la primera." : ""}</p> : null}
        {missions.map((m, i) => {
          const s = stats[i];
          const t = missionTimeline(m);
          return (
            <section key={m.id} className="card flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mono text-[11px] text-muted">
                    {m.code} · {labelOf(MISSION_STATUS, m.status)} · {m.registrationOpen ? "inscripciones abiertas" : "inscripciones cerradas"}
                  </p>
                  <h2 className="text-xl font-extrabold tracking-tight">{m.name}</h2>
                  <p className="text-sm text-muted">
                    {formatDateRange(m.startDate, m.endDate)}
                    {m.location ? ` · ${m.location}` : ""} · {t.badge}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/m/${m.id}`} className="btn-primary">
                    Abrir misión
                  </Link>
                  {canManage ? (
                    <Link href={`/admin/m/${m.id}/editar`} className="btn-secondary">
                      Editar
                    </Link>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>
                    {s.byStatus.confirmado} confirmados · {s.byStatus.lista_espera} en espera · {s.byStatus.pendiente} pendientes
                  </span>
                  <span>
                    {percent(s.byStatus.confirmado, m.capacity)}% de {m.capacity} cupos
                  </span>
                </div>
                <Progress value={s.byStatus.confirmado} max={m.capacity} />
              </div>
            </section>
          );
        })}
      </PageBody>
    </>
  );
}
