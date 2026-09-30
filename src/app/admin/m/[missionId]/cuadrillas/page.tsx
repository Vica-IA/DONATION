import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { areaInfo } from "@/lib/catalogs";
import { getMissionById, getMissionStats } from "@/lib/data";
import { can } from "@/lib/permissions";
import { listSquads } from "@/lib/program";
import { SquadForm } from "./squad-form";

export const metadata = { title: "Cuadrillas" };

export default async function SquadsPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/cuadrillas`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const manage = can(user.role, "program.manage");
  const [list, stats] = await Promise.all([listSquads(mission.id), getMissionStats(mission)]);
  const assigned = list.reduce((acc, s) => acc + s.members.length, 0);
  const base = `/admin/m/${mission.id}`;

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Cuadrillas"
        badge={
          <span className="text-xs text-muted">
            {list.length} cuadrillas · {assigned} de {stats.byStatus.confirmado} confirmados asignados
          </span>
        }
        actions={
          <a href={`/misiones/${mission.slug}`} className="btn-secondary" target="_blank" rel="noopener noreferrer">
            Ver página pública
          </a>
        }
      />
      <PageBody>
        <p className="text-[13px] text-muted">Cada persona confirmada pertenece a una sola cuadrilla. Abre una cuadrilla para elegir integrantes y líder.</p>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.length === 0 ? <p className="card text-sm text-muted sm:col-span-2 xl:col-span-3">Todavía no hay cuadrillas.</p> : null}
          {list.map((s) => {
            const a = s.area ? areaInfo(s.area) : null;
            return (
              <Link key={s.id} href={`${base}/cuadrillas/${s.id}`} className="card-tight flex flex-col gap-2 transition hover:border-brand-300" data-squad-name={s.name}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold">{s.name}</span>
                  <span className="mono text-[13px] text-muted">{s.members.length}</span>
                </div>
                {a ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: a.color }}>
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: a.color }} />
                    {a.short}
                  </span>
                ) : null}
                <span className="text-sm text-muted">
                  <span className="text-faint">Líder:</span> {s.leader ? s.leader.fullName : "sin asignar"}
                </span>
                {s.meetingPoint ? <span className="text-xs text-muted">{s.meetingPoint}</span> : null}
              </Link>
            );
          })}
        </section>
        {manage ? <SquadForm missionId={mission.id} /> : null}
      </PageBody>
    </>
  );
}
