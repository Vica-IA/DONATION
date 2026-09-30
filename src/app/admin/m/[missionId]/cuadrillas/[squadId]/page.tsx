import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { ROLES, labelOf } from "@/lib/catalogs";
import { getMissionById, listRegistrations } from "@/lib/data";
import { can } from "@/lib/permissions";
import { getSquad, listSquads } from "@/lib/program";
import { deleteSquadAction, setSquadMembersAction } from "../actions";
import { SquadForm } from "../squad-form";

export default async function SquadPage({
  params,
  searchParams,
}: {
  params: Promise<{ missionId: string; squadId: string }>;
  searchParams: Promise<{ integrantes?: string }>;
}) {
  const { missionId, squadId } = await params;
  const { integrantes } = await searchParams;
  const user = await requireUser(`/admin/m/${missionId}/cuadrillas/${squadId}`);
  if (!can(user.role, "program.manage")) redirect(`/admin/m/${missionId}?denegado=1`);
  const [mission, squad] = await Promise.all([getMissionById(missionId), getSquad(squadId)]);
  if (!mission || !squad || squad.missionId !== mission.id) notFound();
  const [confirmed, allSquads] = await Promise.all([listRegistrations(mission, { status: "confirmado" }), listSquads(mission.id)]);
  const squadNames = new Map(allSquads.map((s) => [s.id, s.name] as const));

  return (
    <>
      <PageHeader
        kicker={`${mission.name} · Cuadrillas`}
        title={squad.name}
        badge={<span className="text-xs text-muted">{squad.members.length} integrantes</span>}
        actions={
          <Link href={`/admin/m/${mission.id}/cuadrillas`} className="btn-secondary">
            ← Cuadrillas
          </Link>
        }
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <SquadForm missionId={mission.id} squad={squad} />
            <form action={deleteSquadAction.bind(null, mission.id, squad.id)} className="card">
              <h2 className="section-title">Eliminar</h2>
              <p className="mb-3 mt-1 text-sm text-muted">Las personas quedan sin cuadrilla; sus inscripciones no se tocan.</p>
              <button type="submit" className="btn-danger border border-danger/30">
                Eliminar cuadrilla
              </button>
            </form>
          </div>
          <form action={setSquadMembersAction.bind(null, mission.id, squad.id)} className="card space-y-3">
            <h2 className="section-title">Integrantes</h2>
            <p className="text-sm text-muted">Solo personas confirmadas. Quien ya está en otra cuadrilla aparece atenuado; quítalo allá primero.</p>
            {integrantes === "ok" ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">Integrantes guardados.</div> : null}
            {confirmed.length === 0 ? <p className="text-sm text-muted">Todavía no hay personas confirmadas.</p> : null}
            <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
              {confirmed.map(({ registration: r, volunteer: v, organization: o }) => {
                const inOther = Boolean(r.squadId && r.squadId !== squad.id);
                return (
                  <label key={r.id} className={`choice ${inOther ? "opacity-50" : ""}`}>
                    <input type="checkbox" name="members" value={r.id} defaultChecked={r.squadId === squad.id} disabled={inOther} className="mt-0.5" />
                    <span>
                      {v.fullName}
                      <span className="block text-xs text-muted">
                        {[o?.name, v.refugio, labelOf(ROLES, r.assignedRole ?? r.preferredRole) || null].filter(Boolean).join(" · ")}
                        {inOther ? ` · en ${squadNames.get(r.squadId!) ?? "otra cuadrilla"}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <button type="submit" className="btn-primary">
              Guardar integrantes
            </button>
          </form>
        </div>
      </PageBody>
    </>
  );
}
