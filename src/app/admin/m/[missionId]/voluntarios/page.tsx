import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PAYMENT_STATUS, REGISTRATION_STATUS, ROLES, labelOf } from "@/lib/catalogs";
import { getMissionById, getMissionStats, listOrganizations, listRegistrations, missionHasTerms } from "@/lib/data";
import { formatDateRange } from "@/lib/format";
import { can, canExport, participantScope } from "@/lib/permissions";

export const metadata = { title: "Voluntarios" };

type Props = {
  params: Promise<{ missionId: string }>;
  searchParams: Promise<{ q?: string; estado?: string; grupo?: string; requisito?: string }>;
};

export default async function MissionParticipantsPage({ params, searchParams }: Props) {
  const { missionId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/voluntarios`);
  const exportAllowed = canExport(user);
  const canManage = can(user.role, "participants.manage");
  const canEditMission = can(user.role, "missions.manage");
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const { q = "", estado = "", requisito = "" } = await searchParams;
  let { grupo = "" } = await searchParams;
  const scope = participantScope(user);
  if (scope.kind === "organization") grupo = scope.organizationId; // un líder solo ve su grupo
  const hasTerms = missionHasTerms(mission);
  const base = `/admin/m/${mission.id}`;

  const [rows, organizations, stats] = await Promise.all([
    listRegistrations(mission, { q, status: estado, organizationId: grupo, requisito }),
    listOrganizations(),
    getMissionStats(mission),
  ]);

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
              <a href={`${base}/export`} className="btn-secondary">
                Descargar CSV
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
      {scope.kind === "organization" ? (
        <p className="text-xs text-muted">Ves únicamente las personas de tu grupo ({organizations.find((o) => o.id === grupo)?.name ?? "grupo"}). Fechas: {formatDateRange(mission.startDate, mission.endDate)}.</p>
      ) : null}

      <form className="card-tight grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]" method="get">
        <input name="q" className="input" placeholder="Buscar por nombre, documento, teléfono o correo" defaultValue={q} />
        <select name="estado" className="input sm:w-44" defaultValue={estado}>
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
          <select name="grupo" className="input sm:w-44" defaultValue={grupo}>
            <option value="">Todos los grupos</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <select name="requisito" className="input sm:w-52" defaultValue={requisito}>
          <option value="">Todos los requisitos</option>
          {hasTerms ? <option value="condiciones">Condiciones pendientes</option> : null}
          <option value="aporte">Aporte pendiente</option>
        </select>
        <button type="submit" className="btn-primary">
          Filtrar
        </button>
      </form>

      <div className="card-tight overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Nombre</th>
              <th>Grupo</th>
              <th>Contacto</th>
              <th>Documento</th>
              <th>Rol</th>
              <th>Requisitos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-muted">
                  No hay inscripciones con esos criterios.
                </td>
              </tr>
            ) : (
              rows.map(({ registration: r, volunteer: v, organization: o, termsAcceptedAt }) => (
                <tr key={r.id} className="hover:bg-paper-2">
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <Link href={`${base}/voluntarios/${r.id}`} className="font-semibold text-ink hover:text-brand-700">
                      {v.fullName}
                    </Link>
                    {v.city ? <div className="text-xs text-muted">{v.city}</div> : null}
                  </td>
                  <td>
                    {o?.name ?? v.organizationOther ?? <span className="text-faint">—</span>}
                    {v.refugio ? <div className="text-xs text-muted">Refugio: {v.refugio}</div> : null}
                  </td>
                  <td>
                    <a href={`https://wa.me/${v.phone.replace(/\D/g, "")}`} className="text-brand-700 hover:underline" target="_blank" rel="noopener noreferrer">
                      {v.phone}
                    </a>
                    {v.email ? <div className="text-xs text-muted">{v.email}</div> : null}
                  </td>
                  <td className="whitespace-nowrap text-muted">
                    {v.docType} {v.docNumber}
                  </td>
                  <td>
                    {r.assignedRole ? (
                      <span className="font-medium">{labelOf(ROLES, r.assignedRole)}</span>
                    ) : r.preferredRole ? (
                      <span className="text-muted">{labelOf(ROLES, r.preferredRole)} (pref.)</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="space-y-1 whitespace-nowrap">
                    {hasTerms ? (
                      <div>
                        <span className={termsAcceptedAt ? "badge-confirmado" : "badge-lista_espera"}>
                          {termsAcceptedAt ? "Condiciones ✓" : "Condiciones pendientes"}
                        </span>
                      </div>
                    ) : null}
                    <div>
                      <span className={r.paymentStatus === "pagado" || r.paymentStatus === "exento" ? "badge-confirmado" : "badge-lista_espera"}>
                        Aporte: {labelOf(PAYMENT_STATUS, r.paymentStatus).toLowerCase()}
                      </span>
                    </div>
                  </td>
                  <td>
                    <Link href={`${base}/voluntarios/${r.id}`} className="btn-ghost px-2 py-1 text-xs">
                      {canManage ? "Gestionar" : "Ver"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        {rows.length} {rows.length === 1 ? "registro" : "registros"} en esta vista.
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
