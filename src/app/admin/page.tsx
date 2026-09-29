import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { Progress } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MISSION_STATUS, ROLES, TRANSPORT, AVAILABILITY, labelOf } from "@/lib/catalogs";
import { siteUrl } from "@/lib/config";
import { getMissionStats, listMissions, recentActivity } from "@/lib/data";
import { formatDateRange, formatDateTime, percent } from "@/lib/format";
import { can } from "@/lib/permissions";

export const metadata = { title: "Panel" };

const ENTITY_LABELS: Record<string, string> = { mission: "Misión", registration: "Inscripción", volunteer: "Persona", user: "Usuario" };
const ACTION_LABELS: Record<string, string> = {
  creada: "creada",
  creado: "creado",
  actualizada: "actualizada",
  actualizado: "actualizado",
  actualizada_por_persona: "actualizada por la persona",
  actualizada_por_admin: "actualizada por el equipo",
  contrasena_restablecida: "contraseña restablecida",
  contrasena_cambiada: "contraseña cambiada",
};

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denegado?: string; cuenta?: string }> }) {
  const user = await requireUser("/admin");
  const { denegado, cuenta } = await searchParams;
  const canManageMissions = can(user.role, "missions.manage");
  const canExport = can(user.role, "participants.export");
  const missions = await listMissions();
  const stats = await Promise.all(missions.map((m) => getMissionStats(m)));
  const activity = await recentActivity(10);

  return (
    <div className="space-y-8">
      {denegado ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          No tienes permiso para esa acción. Pide a un administrador que ajuste tu rol si la necesitas.
        </div>
      ) : null}
      {cuenta === "ok" ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800" role="status">
          Contraseña actualizada. Tus otras sesiones se cerraron.
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Misiones</h1>
          <p className="text-sm text-slate-500">Confirmaciones, cupos y logística de cada misión.</p>
        </div>
        {canManageMissions ? (
          <Link href="/admin/misiones/nueva" className="btn-secondary">
            + Nueva misión
          </Link>
        ) : null}
      </div>

      {missions.map((m, i) => {
        const s = stats[i];
        const formUrl = `${siteUrl()}/misiones/${m.slug}/confirmar`;
        const waText = encodeURIComponent(
          `Hola, te comparto el formulario para confirmar tu participación en ${m.name} (${formatDateRange(m.startDate, m.endDate)}): ${formUrl}`,
        );
        return (
          <section key={m.id} className="card space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  {m.code} · {labelOf(MISSION_STATUS, m.status)} · {m.registrationOpen ? "inscripciones abiertas" : "inscripciones cerradas"}
                </p>
                <h2 className="text-xl font-bold">{m.name}</h2>
                <p className="text-sm text-slate-600">
                  {formatDateRange(m.startDate, m.endDate)}
                  {m.location ? ` · ${m.location}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/misiones/${m.id}`} className="btn-primary">
                  Ver participantes
                </Link>
                {canManageMissions ? (
                  <Link href={`/admin/misiones/${m.id}/editar`} className="btn-secondary">
                    Editar
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="kpi">
                <p className="kpi-label">Cupos</p>
                <p className="kpi-value">{m.capacity}</p>
              </div>
              <div className="kpi border-brand-200 bg-brand-50">
                <p className="kpi-label text-brand-700">Confirmados</p>
                <p className="kpi-value text-brand-800">{s.byStatus.confirmado}</p>
              </div>
              <div className="kpi">
                <p className="kpi-label">Lista de espera</p>
                <p className="kpi-value">{s.byStatus.lista_espera}</p>
              </div>
              <div className="kpi">
                <p className="kpi-label">Pendientes</p>
                <p className="kpi-value">{s.byStatus.pendiente}</p>
              </div>
              <div className="kpi">
                <p className="kpi-label">Cancelados</p>
                <p className="kpi-value">{s.byStatus.cancelado}</p>
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Ocupación</span>
                <span>
                  {percent(s.byStatus.confirmado, m.capacity)}% · {s.available} cupos disponibles
                </span>
              </div>
              <Progress value={s.byStatus.confirmado} max={m.capacity} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Breakdown
                title="Por grupo"
                rows={s.byOrganization.map((r) => ({ label: r.name, value: `${r.confirmed} / ${r.total}` }))}
                empty="Aún no hay inscripciones."
                hint="confirmados / inscritos"
              />
              <Breakdown
                title="Por rol (confirmados)"
                rows={s.byRole.map((r) => ({ label: r.role === "sin_definir" ? "Sin definir" : labelOf(ROLES, r.role), value: String(r.confirmed) }))}
                empty="Sin confirmados todavía."
              />
              <Breakdown
                title="Logística (confirmados)"
                rows={[
                  ...s.byTransport.map((r) => ({ label: labelOf(TRANSPORT, r.transport), value: String(r.confirmed) })),
                  ...s.byAvailability.map((r) => ({ label: labelOf(AVAILABILITY, r.availability), value: String(r.confirmed) })),
                ]}
                empty="Sin confirmados todavía."
              />
            </div>

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enlace del formulario</p>
              <p className="mt-1 break-all font-mono text-sm">{formUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={formUrl} />
                <a className="btn-accent" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">
                  Compartir por WhatsApp
                </a>
                {canExport ? (
                  <a className="btn-ghost" href={`/admin/misiones/${m.id}/export`}>
                    Descargar CSV
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}

      <section className="card">
        <h2 className="section-title">Actividad reciente</h2>
        {activity.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Todavía no hay movimientos registrados.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{ENTITY_LABELS[a.entityType] ?? a.entityType}</span> · {ACTION_LABELS[a.action] ?? a.action}
                  {a.detail ? <span className="text-slate-500"> · {a.detail}</span> : null}
                </span>
                <span className="text-xs text-slate-400">
                  {a.actor} · {formatDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  empty,
  hint,
}: {
  title: string;
  rows: { label: string; value: string }[];
  empty: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
        {hint ? <span className="ml-1 font-normal normal-case text-slate-400">({hint})</span> : null}
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex justify-between gap-2">
              <span className="truncate">{r.label}</span>
              <span className="font-semibold tabular-nums">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
