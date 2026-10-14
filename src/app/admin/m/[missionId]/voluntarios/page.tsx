import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PAYMENT_STATUS, REGISTRATION_STATUS, ROLES, labelOf } from "@/lib/catalogs";
import { getMissionById, getMissionStats, listOrganizations, listRegistrations, missionHasTerms, registrationFiltersFromParams } from "@/lib/data";
import { formatDateRange, toQuery } from "@/lib/format";
import { can, canExport, participantScope } from "@/lib/permissions";
import { listSquads } from "@/lib/program";

export const metadata = { title: "Voluntarios" };

type Props = {
  params: Promise<{ missionId: string }>;
  searchParams: Promise<{ q?: string; estado?: string; grupo?: string; requisito?: string; eliminada?: string }>;
};

const COLS = "lg:grid-cols-[110px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_120px_80px]";

function payBadge(status: string) {
  return status === "pagado" || status === "exento" ? "badge-confirmado" : status === "parcial" ? "badge-lista_espera" : "badge-pendiente";
}

export default async function MissionParticipantsPage({ params, searchParams }: Props) {
  const { missionId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/voluntarios`);
  const exportAllowed = canExport(user);
  const canManage = can(user.role, "participants.manage");
  const canEditMission = can(user.role, "missions.manage");
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const sp = await searchParams;
  const { eliminada } = sp;
  const scope = participantScope(user);
  const filters = registrationFiltersFromParams(sp);
  if (scope.kind === "organization") filters.organizationId = scope.organizationId; // un líder solo ve su grupo
  const { q, status: estado, organizationId: grupo, requisito } = filters;
  const hasTerms = missionHasTerms(mission);
  const base = `/admin/m/${mission.id}`;
  // La descarga CSV conserva los filtros de la vista (el alcance del líder se vuelve a aplicar en el servidor).
  const filtering = Boolean(q || estado || requisito || (scope.kind !== "organization" && grupo));
  const exportHref = `${base}/export${toQuery({ q, estado, grupo: scope.kind === "organization" ? "" : grupo, requisito })}`;

  const [rows, organizations, stats, squads] = await Promise.all([listRegistrations(mission, filters), listOrganizations(), getMissionStats(mission), listSquads(mission.id)]);
  const squadOf = new Map<string, string>();
  for (const s of squads) for (const m of s.members) squadOf.set(m.registrationId, s.name);

  const phones = rows
    .filter((r) => r.registration.status === "confirmado")
    .map((r) => r.volunteer.phone)
    .join(", ");

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Voluntarios"
        badge={
          <span className="text-xs text-muted">
            {stats.byStatus.confirmado}/{mission.capacity} confirmados · {stats.byStatus.lista_espera} en espera · {stats.byStatus.pendiente} pendientes
            {hasTerms ? ` · condiciones ${stats.termsAccepted}/${stats.byStatus.confirmado}` : ""} · aporte {stats.paid}/{stats.byStatus.confirmado}
          </span>
        }
        actions={
          <>
            {exportAllowed ? (
              <a href={exportHref} className="btn-secondary" title={filtering ? "Descarga solo las personas de esta vista, con los filtros aplicados" : "Descarga todas las personas de la misión"}>
                {filtering ? "Descargar CSV (vista filtrada)" : "Descargar CSV"}
              </a>
            ) : null}
            {canEditMission ? (
              <Link href={`${base}/editar`} className="btn-secondary">
                Editar misión
              </Link>
            ) : null}
          </>
        }
      />
      <PageBody>
        {eliminada ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800" role="status">
            Inscripción de {eliminada} eliminada.
          </div>
        ) : null}
        {scope.kind === "organization" ? (
          <p className="text-xs text-muted">
            Ves únicamente las personas de tu grupo ({organizations.find((o) => o.id === grupo)?.name ?? "grupo"}). Fechas: {formatDateRange(mission.startDate, mission.endDate)}.
          </p>
        ) : null}

        <form className="card-tight grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-center gap-2.5 p-3" method="get">
          <input name="q" className="input" placeholder="Buscar por nombre, documento o teléfono" defaultValue={q} />
          <select name="estado" className="input" defaultValue={estado}>
            <option value="">Todos los estados</option>
            {REGISTRATION_STATUS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {scope.kind === "organization" ? (
            <input type="hidden" name="grupo" value={grupo} />
          ) : (
            <select name="grupo" className="input" defaultValue={grupo}>
              <option value="">Todos los grupos</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <select name="requisito" className="input" defaultValue={requisito}>
            <option value="">Todos los requisitos</option>
            {hasTerms ? <option value="condiciones">Condiciones pendientes</option> : null}
            <option value="aporte">Aporte pendiente</option>
          </select>
          <button type="submit" className="btn-primary">
            Filtrar
          </button>
        </form>

        <section className="overflow-x-auto rounded-2xl border border-line bg-white">
          <div className="lg:min-w-[920px]">
          <div className={`hidden gap-3 border-b border-line bg-paper-2 px-[18px] py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted lg:grid ${COLS}`}>
            <span>Estado</span>
            <span>Nombre</span>
            <span>Grupo</span>
            <span>Contacto</span>
            <span>Documento</span>
            <span>Rol</span>
            <span>Aporte</span>
            <span />
          </div>
          {rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted">No hay inscripciones con esos criterios.</p> : null}
          {rows.map(({ registration: r, volunteer: v, organization: o, termsAcceptedAt }) => {
            const squad = squadOf.get(r.id);
            return (
              <div key={r.id} className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-line-soft px-4 py-3 text-sm last:border-b-0 hover:bg-paper-2 sm:px-[18px] lg:items-center lg:gap-3 ${COLS}`} data-vol={v.fullName}>
                <span>
                  <StatusBadge status={r.status} />
                </span>
                <div className="flex min-w-0 flex-col gap-px">
                  <Link href={`${base}/voluntarios/${r.id}`} className="font-semibold text-ink hover:text-brand-700">
                    {v.fullName}
                  </Link>
                  {v.city || squad ? <span className="text-xs text-muted">{[v.city, squad].filter(Boolean).join(" · ")}</span> : null}
                </div>
                <div className="col-start-2 flex min-w-0 flex-col lg:col-start-auto">
                  <span>{o?.name ?? v.organizationOther ?? <span className="text-faint">—</span>}</span>
                  {v.refugio ? <span className="text-xs text-muted">Refugio: {v.refugio}</span> : null}
                </div>
                <div className="col-start-2 flex min-w-0 flex-col lg:col-start-auto">
                  <a href={`https://wa.me/${v.phone.replace(/\D/g, "")}`} className="break-all text-brand-700 hover:underline" target="_blank" rel="noopener noreferrer">
                    {v.phone}
                  </a>
                  {v.email ? <span className="truncate text-xs text-muted">{v.email}</span> : null}
                </div>
                <span className="col-start-2 break-all text-[13px] text-muted lg:col-start-auto">
                  {v.docType} {v.docNumber}
                </span>
                <span className="col-start-2 text-ink-soft lg:col-start-auto">
                  {r.assignedRole ? (
                    <span className="font-medium">{labelOf(ROLES, r.assignedRole)}</span>
                  ) : r.preferredRole ? (
                    <span className="text-muted">{labelOf(ROLES, r.preferredRole)} (pref.)</span>
                  ) : (
                    <span className="text-faint">Sin rol</span>
                  )}
                </span>
                <div className="col-start-2 flex flex-wrap gap-1 lg:col-start-auto lg:flex-col lg:items-start">
                  <span className={payBadge(r.paymentStatus)} title="Aporte">
                    {labelOf(PAYMENT_STATUS, r.paymentStatus)}
                  </span>
                  {hasTerms && !termsAcceptedAt ? <span className="badge-lista_espera">Condiciones pendientes</span> : null}
                </div>
                <Link href={`${base}/voluntarios/${r.id}`} className="col-start-2 justify-self-start text-xs font-semibold text-brand-700 lg:col-start-auto lg:justify-self-end">
                  {canManage ? "Gestionar" : "Ver"}
                </Link>
              </div>
            );
          })}
          </div>
        </section>
        <p className="text-xs text-muted">
          {rows.length} {rows.length === 1 ? "registro" : "registros"} en esta vista. La información de salud solo la ven el administrador, el líder del grupo y la coordinación de Logística.
        </p>

        {phones ? (
          <details className="card-tight">
            <summary className="cursor-pointer text-sm font-semibold">Teléfonos de confirmados en esta vista (para lista de difusión)</summary>
            <p className="mt-2 break-all font-mono text-xs text-muted">{phones}</p>
          </details>
        ) : null}
      </PageBody>
    </>
  );
}
