import { PageBody, PageHeader } from "@/components/admin-shell";
import { StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listAllRegistrations, listMissionsRaw, listVolunteersWithoutRegistration, registrationActivity, tableCounts } from "@/lib/diagnostics";
import { relinkOrphansAction } from "./actions";

export const metadata = { title: "Diagnóstico de datos" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  creada: "creada",
  actualizada: "actualizada",
  actualizada_por_persona: "actualizada por la persona",
  actualizada_por_admin: "actualizada por el equipo",
  condiciones_aceptadas: "condiciones aceptadas",
  estado: "cambio de estado",
  eliminada: "ELIMINADA",
  inscripciones_revinculadas: "inscripciones vinculadas",
};

export default async function DiagnosticsPage({ searchParams }: { searchParams: Promise<{ vinculadas?: string }> }) {
  await requirePermission("users.manage", "/admin/diagnostico");
  const { vinculadas } = await searchParams;
  const [counts, missions, registrations, loose, activity] = await Promise.all([
    tableCounts(),
    listMissionsRaw(),
    listAllRegistrations(),
    listVolunteersWithoutRegistration(),
    registrationActivity(),
  ]);
  const orphans = registrations.filter((r) => !r.mission || !r.volunteer);
  const deletions = activity.filter((a) => a.action === "eliminada");
  const byMission = new Map<string, number>();
  for (const r of registrations) byMission.set(r.registration.missionId, (byMission.get(r.registration.missionId) ?? 0) + 1);

  return (
    <>
      <PageHeader
        kicker="Equipo"
        title="Diagnóstico de datos"
        badge={<span className="text-xs text-muted">lee la base directamente, sin filtros de misión ni de rol</span>}
        actions={
          <a href="/admin/diagnostico/export" className="btn-primary">
            Descargar CSV de todas las inscripciones
          </a>
        }
      />
      <PageBody>
        {vinculadas !== undefined ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
            {Number(vinculadas) > 0 ? `${vinculadas} inscripciones vinculadas a la misión elegida.` : "No había inscripciones huérfanas que vincular (o faltó la confirmación)."}
          </div>
        ) : null}

        <section>
          <h2 className="section-title">Conteo real por tabla</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {counts.map((c) => (
              <div key={c.table} className="rounded-xl border border-line bg-paper-2 p-3" data-count={c.table}>
                <p className="kpi-label">{c.label}</p>
                <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink" data-count-value={c.n}>
                  {c.n}
                </p>
                <p className="mono text-[11px] text-faint">{c.table}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card-tight overflow-x-auto p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
            <h2 className="section-title">Misiones en la base</h2>
            <span className="text-xs text-muted">Las inscripciones se listan por misión en el panel; si una misión desapareciera, sus inscripciones quedarían ocultas pero no borradas.</span>
          </div>
          <table className="table mt-2">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Inscripciones</th>
                <th>Inscripciones abiertas</th>
                <th>Creada</th>
                <th>Id</th>
              </tr>
            </thead>
            <tbody>
              {missions.map((m) => (
                <tr key={m.id}>
                  <td className="font-semibold">{m.code}</td>
                  <td>{m.name}</td>
                  <td>{byMission.get(m.id) ?? 0}</td>
                  <td>{m.registrationOpen ? "Sí" : "No"}</td>
                  <td>{formatDateTime(m.createdAt)}</td>
                  <td className="mono text-xs text-faint">{m.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {orphans.length > 0 ? (
          <section className="card border-danger/40">
            <h2 className="section-title text-danger">
              {orphans.length} inscripciones huérfanas
            </h2>
            <p className="mt-1 text-sm text-muted">
              Están en la base pero apuntan a una misión o a una persona que ya no existe, por eso el panel no las muestra. Si la misión fue recreada, vincúlalas a la misión actual: no se borra nada y queda en la bitácora.
            </p>
            {missions.length > 0 && orphans.some((r) => !r.mission) ? (
              <form action={relinkOrphansAction} className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Vincular a la misión</span>
                  <select name="missionId" className="input sm:w-72" defaultValue={missions.find((m) => m.registrationOpen)?.id ?? missions[0].id}>
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} · {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="choice">
                  <input type="checkbox" name="confirm" className="mt-0.5" />
                  <span>Entiendo que las inscripciones sin misión pasarán a la misión elegida.</span>
                </label>
                <button type="submit" className="btn-primary">
                  Vincular inscripciones huérfanas
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        <section className="card-tight overflow-x-auto p-0">
          <div className="px-4 pt-4">
            <h2 className="section-title">Todas las inscripciones ({registrations.length})</h2>
            <p className="text-xs text-muted">Sin filtrar por misión, estado ni grupo. Orden: la más antigua primero.</p>
          </div>
          <table className="table mt-2">
            <thead>
              <tr>
                <th>Registrada</th>
                <th>Estado</th>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Teléfono</th>
                <th>Grupo</th>
                <th>Misión</th>
                <th>Condiciones</th>
              </tr>
            </thead>
            <tbody>
              {registrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-sm text-muted">
                    La tabla de inscripciones está vacía.
                  </td>
                </tr>
              ) : null}
              {registrations.map((r) => (
                <tr key={r.registration.id} data-diag-name={r.volunteer?.fullName ?? ""} className={!r.mission || !r.volunteer ? "bg-red-50" : ""}>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(r.registration.createdAt)}</td>
                  <td>
                    <StatusBadge status={r.registration.status} />
                  </td>
                  <td className="font-semibold">{r.volunteer?.fullName ?? <span className="text-danger">persona no encontrada</span>}</td>
                  <td className="mono text-xs">{r.volunteer ? `${r.volunteer.docType} ${r.volunteer.docNumber}` : "—"}</td>
                  <td className="mono text-xs">{r.volunteer?.phone ?? "—"}</td>
                  <td>{r.organization?.name ?? r.volunteer?.organizationOther ?? "—"}</td>
                  <td>{r.mission ? r.mission.code : <span className="text-danger">misión no encontrada ({r.registration.missionId.slice(0, 8)}…)</span>}</td>
                  <td className="text-xs">{r.acceptedAt ? formatDateTime(r.acceptedAt) : "pendientes"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {loose.length > 0 ? (
          <section className="card">
            <h2 className="section-title">{loose.length} personas sin inscripción</h2>
            <p className="mt-1 text-sm text-muted">Quedaron en la tabla de personas sin ninguna inscripción asociada (normalmente por un borrado incompleto). Sus datos siguen aquí:</p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {loose.map((v) => (
                <li key={v.id}>
                  {v.fullName} · {v.docType} {v.docNumber} · {v.phone}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="card-tight overflow-x-auto p-0">
          <div className="px-4 pt-4">
            <h2 className="section-title">Bitácora de inscripciones ({activity.length})</h2>
            <p className="text-xs text-muted">
              Cada inscripción creada, editada o eliminada deja una entrada. {deletions.length > 0 ? `Hay ${deletions.length} eliminaciones registradas.` : "No hay ninguna eliminación registrada."}
            </p>
          </div>
          <table className="table mt-2">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Entidad</th>
                <th>Acción</th>
                <th>Detalle</th>
                <th>Quién</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id} className={a.action === "eliminada" ? "bg-red-50" : ""}>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(a.createdAt)}</td>
                  <td className="text-xs">{a.entityType}</td>
                  <td className={a.action === "eliminada" ? "font-semibold text-danger" : ""}>{ACTION_LABELS[a.action] ?? a.action}</td>
                  <td className="text-xs">{a.detail}</td>
                  <td className="text-xs">{a.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </PageBody>
    </>
  );
}
