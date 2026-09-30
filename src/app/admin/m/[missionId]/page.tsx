import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { CopyButton } from "@/components/copy-button";
import { Progress } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { AREAS, areaInfo } from "@/lib/catalogs";
import { siteUrl } from "@/lib/config";
import { getMissionById, getMissionStats, missionHasTerms, recentActivity } from "@/lib/data";
import { contributionSummary, listEntries, summarizeFinance } from "@/lib/finance";
import { formatCOP, formatDateRange, formatDateTime, formatShortDate, initials, percent } from "@/lib/format";
import { missionTimeline } from "@/lib/mission-timeline";
import { can, canEditTask, canExport, canViewFinance } from "@/lib/permissions";
import { criticalPending, goCriteria, listTasks, summarizeAreas, taskProgress } from "@/lib/tasks";
import { listCoordinators } from "@/lib/users";
import { AreaDot, DueLabel, TaskCheck, defaultOwner } from "./tareas/task-bits";

export const metadata = { title: "Centro de misión" };

const ENTITY_LABELS: Record<string, string> = {
  mission: "Misión",
  registration: "Inscripción",
  volunteer: "Persona",
  user: "Usuario",
  task: "Tarea",
  finance: "Movimiento",
  program: "Programa",
  announcement: "Aviso",
  squad: "Cuadrilla",
};
const ACTION_LABELS: Record<string, string> = {
  creada: "creada",
  creado: "creado",
  actualizada: "actualizada",
  actualizado: "actualizado",
  actualizada_por_persona: "actualizada por la persona",
  actualizada_por_admin: "actualizada por el equipo",
  contrasena_restablecida: "contraseña restablecida",
  enlace_restablecimiento: "enlace de nueva contraseña generado",
  rescate_admin: "acceso de administrador restablecido (rescate)",
  contrasena_cambiada: "contraseña cambiada",
  condiciones_aceptadas: "condiciones aceptadas",
  estado: "cambio de estado",
  eliminada: "eliminada",
  registrado: "registrado",
  eliminado: "eliminado",
  actividad_creada: "actividad agregada",
  actividad_actualizada: "actividad actualizada",
  actividad_eliminada: "actividad eliminada",
  aviso_publicado: "publicado",
  aviso_actualizado: "actualizado",
  aviso_eliminado: "eliminado",
  cuadrilla_creada: "creada",
  cuadrilla_actualizada: "actualizada",
  cuadrilla_eliminada: "eliminada",
  integrantes_actualizados: "integrantes actualizados",
};

type Props = { params: Promise<{ missionId: string }>; searchParams: Promise<{ denegado?: string; cuenta?: string }> };

export default async function MissionOverview({ params, searchParams }: Props) {
  const { missionId } = await params;
  const { denegado, cuenta } = await searchParams;
  const user = await requireUser(`/admin/m/${missionId}`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const financeAllowed = canViewFinance(user);
  const [stats, tasks, coordinators, activity, entries, aportes] = await Promise.all([
    getMissionStats(mission),
    listTasks(mission.id),
    listCoordinators(),
    recentActivity(8),
    financeAllowed ? listEntries(mission.id) : Promise.resolve([]),
    financeAllowed ? contributionSummary(mission) : Promise.resolve(null),
  ]);
  const finance = financeAllowed && aportes ? { count: entries.length, summary: summarizeFinance(entries, aportes) } : null;
  const timeline = missionTimeline(mission);
  const areas = summarizeAreas(tasks, timeline.today);
  const go = goCriteria(tasks);
  const critical = criticalPending(tasks, 6);
  const base = `/admin/m/${mission.id}`;
  const formUrl = `${siteUrl()}/misiones/${mission.slug}/confirmar`;
  const waText = encodeURIComponent(`Hola, te comparto el formulario para confirmar tu participación en ${mission.name} (${formatDateRange(mission.startDate, mission.endDate)}): ${formUrl}`);

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Centro de misión"
        badge={
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-900 px-3 py-1.5 text-[13px] font-semibold text-paper">
            <span className="h-[7px] w-[7px] rounded-full bg-accent-500" />
            {timeline.badge}
          </span>
        }
        actions={can(user.role, "missions.manage") ? <Link href={`${base}/editar`} className="btn-secondary">Editar misión</Link> : null}
      />
      <PageBody>
        {denegado ? (
          <div className="rounded-xl border border-amber-200 bg-warn-soft p-3 text-sm text-warn" role="alert">
            No tienes permiso para esa acción. Pide a un administrador que ajuste tu rol si la necesitas.
          </div>
        ) : null}
        {cuenta === "ok" ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800" role="status">
            Contraseña actualizada. Tus otras sesiones se cerraron.
          </div>
        ) : null}

        {/* Hero */}
        <section className="flex flex-col gap-5 rounded-[20px] bg-brand-900 p-6 text-paper sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-accent-500">Fase actual · {timeline.phaseName}</span>
              <span className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[34px]">1 vivienda + 1 modelo replicable</span>
              <span className="text-[15px] text-[#cfe3db]">Primero verificamos. Después asignamos. Luego ejecutamos. Finalmente demostramos.</span>
            </div>
            <div className="flex gap-7">
              <div className="flex flex-col">
                <span className="text-[40px] font-extrabold leading-none tracking-[-0.03em]">{timeline.status === "campo" ? timeline.dayOfMission : timeline.daysLeft}</span>
                <span className="text-xs text-[#a9c9bd]">{timeline.status === "campo" ? "día de misión" : timeline.status === "antes" ? "días a la salida" : "días desde el cierre"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[40px] font-extrabold leading-none tracking-[-0.03em]">
                  {go.done}/{go.total}
                </span>
                <span className="text-xs text-[#a9c9bd]">criterios Go listos</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[40px] font-extrabold leading-none tracking-[-0.03em]">{taskProgress(tasks)}%</span>
                <span className="text-xs text-[#a9c9bd]">tareas cumplidas</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {timeline.phases.map((p) => (
              <div key={p.key} className="flex flex-col gap-1.5">
                <div className="h-1.5 rounded" style={{ background: p.state === "past" ? "#157a5e" : p.state === "current" ? "#f0b23e" : "rgba(255,255,255,.15)" }} />
                <span className="truncate text-xs font-semibold" style={{ color: p.state === "current" ? "#f0b23e" : p.state === "past" ? "#cfe3db" : "#7fa99a" }}>
                  {p.name}
                </span>
                <span className="mono text-[10px] text-[#7fa99a]">
                  {formatShortDate(p.start)} – {formatShortDate(p.end)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Voluntarios */}
        <section className="card-tight flex flex-col gap-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="section-title">Voluntarios</span>
              <span className="ml-2 text-sm text-muted">
                {stats.byStatus.confirmado} de {mission.capacity} cupos · {stats.available} disponibles
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`${base}/voluntarios`} className="btn-primary">
                Ver voluntarios
              </Link>
              <CopyButton text={formUrl} label="Copiar formulario" />
              <a className="btn-accent" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              {canExport(user) ? (
                <a className="btn-ghost" href={`${base}/export`}>
                  CSV
                </a>
              ) : null}
            </div>
          </div>
          <Progress value={stats.byStatus.confirmado} max={mission.capacity} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Confirmados" value={stats.byStatus.confirmado} highlight />
            <Kpi label="Lista de espera" value={stats.byStatus.lista_espera} />
            <Kpi label="Pendientes" value={stats.byStatus.pendiente} />
            <Kpi label="Cancelados" value={stats.byStatus.cancelado} />
            {missionHasTerms(mission) ? <Kpi label="Condiciones ✓" value={`${stats.termsAccepted}/${stats.byStatus.confirmado}`} /> : <Kpi label="Ocupación" value={`${percent(stats.byStatus.confirmado, mission.capacity)}%`} />}
            <Kpi label="Aporte pagado" value={`${stats.paid}/${stats.byStatus.confirmado}`} />
          </div>
          {stats.byOrganization.length > 0 ? (
            <p className="text-sm text-muted">
              Por grupo:{" "}
              {stats.byOrganization.map((o, i) => (
                <span key={o.name}>
                  {i > 0 ? " · " : ""}
                  <span className="font-semibold text-ink">{o.name}</span> {o.confirmed}/{o.total}
                </span>
              ))}
            </p>
          ) : null}
        </section>

        {/* Finanzas */}
        {finance ? (
          <section className="card-tight flex flex-col gap-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="section-title">Finanzas</span>
                <span className="ml-2 text-sm text-muted">
                  {finance.count} movimientos · presupuesto {formatCOP(finance.summary.gastos.proyectado)}
                </span>
              </div>
              <Link href={`${base}/finanzas`} className="btn-secondary">
                Ver finanzas
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Gastos ejecutados" value={formatCOP(finance.summary.gastos.ejecutado)} />
              <Kpi label="Disponible" value={formatCOP(finance.summary.gastos.disponible)} />
              <Kpi label="Ingresos recibidos" value={formatCOP(finance.summary.ingresos.ejecutado)} highlight />
              <Kpi label="Balance actual" value={formatCOP(finance.summary.balanceActual)} highlight />
            </div>
            {finance.summary.faltante > 0 ? (
              <p className="text-sm font-semibold text-warn">Falta por recaudar {formatCOP(finance.summary.faltante)} para cubrir el presupuesto de gastos.</p>
            ) : null}
          </section>
        ) : null}

        {/* Coordinadores */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {areas
            .filter((s) => s.area !== "general")
            .map((s) => {
              const a = areaInfo(s.area);
              const person = coordinators.get(s.area as (typeof AREAS)[number]["value"]);
              return (
                <Link key={s.area} href={`${base}/areas/${s.area}`} className="card-tight flex flex-col gap-3 transition hover:border-brand-300">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: a.color }}>
                      {person ? initials(person.name) : a.initials}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-xs text-muted">{a.label}</span>
                      <span className="truncate text-[15px] font-bold">{person ? person.name : "Sin coordinador asignado"}</span>
                    </div>
                    <span className="mono text-[13px] font-semibold">
                      {s.done}/{s.total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full" style={{ width: `${percent(s.done, s.total)}%`, background: a.color }} />
                  </div>
                  <div className="text-[13px] leading-snug text-ink-soft">
                    <span className="text-faint">Siguiente:</span>{" "}
                    {s.next ? `${s.next.title}${s.next.dueDate ? ` · ${formatShortDate(s.next.dueDate)}` : ""}` : s.total === 0 ? "Sin tareas" : "Todo listo"}
                    {s.overdue > 0 ? <span className="ml-1 font-semibold text-danger">· {s.overdue} vencidas</span> : null}
                  </div>
                </Link>
              );
            })}
        </section>

        {/* Go/No-Go + críticos */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="card-tight flex flex-col gap-3 sm:p-5">
            <div className="flex items-baseline justify-between">
              <span className="section-title">Criterios Go / No-Go</span>
              <span className="text-[13px] text-muted">
                Cierre operativo {formatShortDate(timeline.phases[2].start)}–{formatShortDate(timeline.phases[2].end)} · {go.done}/{go.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent(go.done, go.total)}%` }} />
            </div>
            {go.items.length === 0 ? (
              <p className="text-sm text-muted">Marca tareas como &ldquo;Criterio Go / No-Go&rdquo; para verlas aquí.</p>
            ) : (
              <div className="grid gap-x-4 sm:grid-cols-2">
                {go.items.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 border-b border-line-soft py-1.5 text-sm">
                    <TaskCheck missionId={mission.id} task={t} editable={canEditTask(user, t)} />
                    <Link href={`${base}/tareas/${t.id}`} className={`min-w-0 flex-1 truncate ${t.status === "hecha" ? "text-muted line-through" : "text-ink"}`}>
                      {t.title}
                    </Link>
                    <span className="text-[11px] text-faint">{areaInfo(t.area).short}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card-tight flex flex-col gap-2 sm:p-5">
            <div className="flex items-baseline justify-between">
              <span className="section-title">Pendientes críticos</span>
              <Link href={`${base}/tareas`} className="text-[13px] font-semibold text-brand-700">
                Ver tablero →
              </Link>
            </div>
            {critical.length === 0 ? <p className="text-sm text-muted">No hay tareas pendientes.</p> : null}
            {critical.map((t) => (
              <div key={t.id} className="flex items-center gap-3 border-b border-line-soft py-2">
                <AreaDot area={t.area} withLabel={false} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`${base}/tareas/${t.id}`} className="truncate text-sm font-semibold hover:text-brand-700">
                    {t.title}
                  </Link>
                  <span className="text-xs text-muted">
                    {areaInfo(t.area).short} · {t.ownerName ?? defaultOwner(t.area)}
                  </span>
                </div>
                <DueLabel task={t} today={timeline.today} />
              </div>
            ))}
          </div>
        </section>

        <section className="card-tight sm:p-5">
          <span className="section-title">Actividad reciente</span>
          {activity.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Todavía no hay movimientos registrados.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line-soft text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{ENTITY_LABELS[a.entityType] ?? a.entityType}</span> · {ACTION_LABELS[a.action] ?? a.action}
                    {a.detail ? <span className="text-muted"> · {a.detail}</span> : null}
                  </span>
                  <span className="text-xs text-faint">
                    {a.actor} · {formatDateTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  );
}

function Kpi({ label, value, highlight = false }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-brand-200 bg-brand-50" : "border-line bg-paper-2"}`}>
      <p className="kpi-label">{label}</p>
      <p className={`mt-0.5 text-2xl font-extrabold tracking-tight ${highlight ? "text-brand-800" : "text-ink"}`}>{value}</p>
    </div>
  );
}
