import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { AVAILABILITY, PAYMENT_STATUS, REGISTRATION_STATUS, ROLES, TRANSPORT, labelOf } from "@/lib/catalogs";
import { getMissionById, getMissionStats, listOrganizations, listRegistrations, missionHasTerms } from "@/lib/data";
import { formatDateRange } from "@/lib/format";
import { can } from "@/lib/permissions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; estado?: string; grupo?: string; requisito?: string }>;
};

export default async function MissionParticipantsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const user = await requireUser(`/admin/misiones/${id}`);
  const canExport = can(user.role, "participants.export");
  const canManage = can(user.role, "participants.manage");
  const canEditMission = can(user.role, "missions.manage");
  const mission = await getMissionById(id);
  if (!mission) notFound();
  const { q = "", estado = "", grupo = "", requisito = "" } = await searchParams;
  const hasTerms = missionHasTerms(mission);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-xs text-slate-500 hover:text-brand-700">
            ← Misiones
          </Link>
          <h1 className="text-2xl font-bold">{mission.name}</h1>
          <p className="text-sm text-slate-600">
            {formatDateRange(mission.startDate, mission.endDate)} · {stats.byStatus.confirmado}/{mission.capacity} confirmados ·{" "}
            {stats.byStatus.lista_espera} en espera · {stats.byStatus.pendiente} pendientes
            {hasTerms ? ` · condiciones aceptadas ${stats.termsAccepted}/${stats.byStatus.confirmado}` : ""} · aporte pagado {stats.paid}/
            {stats.byStatus.confirmado}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? (
            <a href={`/admin/misiones/${mission.id}/export`} className="btn-secondary">
              Descargar CSV
            </a>
          ) : null}
          {canEditMission ? (
            <Link href={`/admin/misiones/${mission.id}/editar`} className="btn-secondary">
              Editar misión
            </Link>
          ) : null}
        </div>
      </div>

      <form className="card grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]" method="get">
        <input name="q" className="input" placeholder="Buscar por nombre, documento, teléfono o correo" defaultValue={q} />
        <select name="estado" className="input sm:w-44" defaultValue={estado}>
          <option value="">Todos los estados</option>
          {REGISTRATION_STATUS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="grupo" className="input sm:w-44" defaultValue={grupo}>
          <option value="">Todos los grupos</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select name="requisito" className="input sm:w-52" defaultValue={requisito}>
          <option value="">Todos los requisitos</option>
          {hasTerms ? <option value="condiciones">Condiciones pendientes</option> : null}
          <option value="aporte">Aporte pendiente</option>
        </select>
        <button type="submit" className="btn-primary">
          Filtrar
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Nombre</th>
              <th>Grupo</th>
              <th>Contacto</th>
              <th>Documento</th>
              <th>Rol</th>
              <th>Logística</th>
              <th>Requisitos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-500">
                  No hay inscripciones con esos criterios.
                </td>
              </tr>
            ) : (
              rows.map(({ registration: r, volunteer: v, organization: o, termsAcceptedAt }) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <Link href={`/admin/participantes/${r.id}`} className="font-semibold text-ink hover:text-brand-700">
                      {v.fullName}
                    </Link>
                    {v.city ? <div className="text-xs text-slate-500">{v.city}</div> : null}
                  </td>
                  <td>{o?.name ?? v.organizationOther ?? <span className="text-slate-400">—</span>}</td>
                  <td>
                    <a href={`https://wa.me/${v.phone.replace(/\D/g, "")}`} className="text-brand-700 hover:underline" target="_blank" rel="noopener noreferrer">
                      {v.phone}
                    </a>
                    {v.email ? <div className="text-xs text-slate-500">{v.email}</div> : null}
                  </td>
                  <td className="whitespace-nowrap text-slate-600">
                    {v.docType} {v.docNumber}
                  </td>
                  <td>
                    {r.assignedRole ? (
                      <span className="font-medium">{labelOf(ROLES, r.assignedRole)}</span>
                    ) : r.preferredRole ? (
                      <span className="text-slate-500">{labelOf(ROLES, r.preferredRole)} (pref.)</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-xs text-slate-600">
                    <div>{labelOf(TRANSPORT, r.transport)}</div>
                    <div>{labelOf(AVAILABILITY, r.availability)}</div>
                    {r.availabilityNotes ? <div className="text-slate-400">{r.availabilityNotes}</div> : null}
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
                    <Link href={`/admin/participantes/${r.id}`} className="btn-ghost px-2 py-1 text-xs">
                      {canManage ? "Gestionar" : "Ver"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        {rows.length} {rows.length === 1 ? "registro" : "registros"} en esta vista.
      </p>

      {phones ? (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold">Teléfonos de confirmados en esta vista (para lista de difusión)</summary>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">{phones}</p>
        </details>
      ) : null}
    </div>
  );
}
