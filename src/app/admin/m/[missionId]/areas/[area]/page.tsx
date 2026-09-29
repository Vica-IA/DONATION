import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { AREAS, AREA_VOLUNTEER_ROLES, ROLES, areaInfo, isArea, labelOf } from "@/lib/catalogs";
import { getMissionById, listVolunteersForArea } from "@/lib/data";
import { initials } from "@/lib/format";
import { todayBogota } from "@/lib/mission-timeline";
import { can, canEditTask, taskAreasFor } from "@/lib/permissions";
import { listTasks } from "@/lib/tasks";
import { listAssignableUsers, listCoordinators } from "@/lib/users";
import { DueLabel, StatusPill, TaskCheck } from "../../tareas/task-bits";
import { TaskForm } from "../../tareas/task-form";

export default async function AreaPage({ params }: { params: Promise<{ missionId: string; area: string }> }) {
  const { missionId, area } = await params;
  if (!isArea(area)) notFound();
  const user = await requireUser(`/admin/m/${missionId}/areas/${area}`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const info = areaInfo(area);
  const [tasks, coordinators, people, team] = await Promise.all([
    listTasks(mission.id),
    listCoordinators(),
    listAssignableUsers(),
    listVolunteersForArea(mission, AREA_VOLUNTEER_ROLES[area]),
  ]);
  const person = coordinators.get(area);
  const areaTasks = tasks.filter((t) => t.area === area);
  const done = areaTasks.filter((t) => t.status === "hecha").length;
  const today = todayBogota();
  const overdue = areaTasks.filter((t) => t.status !== "hecha" && t.dueDate && t.dueDate < today).length;
  const base = `/admin/m/${mission.id}`;
  const allowed = taskAreasFor(user);
  const canCreateHere = allowed === "all" || (Array.isArray(allowed) && allowed.includes(area));
  const wa = person?.phone ? `https://wa.me/${person.phone.replace(/\D/g, "")}` : null;

  return (
    <>
      <PageHeader kicker={mission.name} title="Coordinación por áreas" />
      <PageBody>
        <div className="flex flex-wrap gap-1.5">
          {AREAS.map((a) => {
            const on = a.value === area;
            return (
              <Link
                key={a.value}
                href={`${base}/areas/${a.value}`}
                className={`inline-flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-sm font-semibold ${on ? "border-line-strong bg-white text-ink" : "border-transparent text-muted hover:bg-white"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                {a.short}
              </Link>
            );
          })}
        </div>

        <section className="card flex flex-wrap items-center gap-5 rounded-[18px]">
          <span className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-extrabold text-white" style={{ background: info.color }}>
            {person ? initials(person.name) : info.initials}
          </span>
          <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-semibold" style={{ color: info.color }}>
              Coordinación de {info.label}
            </span>
            <span className="text-2xl font-extrabold tracking-[-0.02em]">{person ? person.name : "Sin coordinador asignado"}</span>
            <span className="text-sm leading-relaxed text-muted">{info.description}</span>
            {!person && can(user.role, "users.manage") ? (
              <Link href="/admin/usuarios/nuevo" className="mt-1 text-sm font-semibold text-brand-700">
                Crear usuario coordinador de {info.short} →
              </Link>
            ) : null}
          </div>
          <div className="flex gap-6">
            <Stat value={`${done}/${areaTasks.length}`} label="tareas hechas" />
            <Stat value={overdue} label="vencidas" danger={overdue > 0} />
            <Stat value={team.length} label="voluntarios del área" />
          </div>
          {person ? (
            <div className="flex flex-col gap-1.5">
              <span className="mono text-[13px]">{person.phone ?? person.email}</span>
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-accent">
                  Escribir por WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <section className="card-tight flex flex-col gap-1 sm:p-5">
              <div className="flex items-baseline justify-between">
                <span className="section-title">Tareas del área</span>
                <span className="mono text-[13px]">
                  {done}/{areaTasks.length}
                </span>
              </div>
              {areaTasks.length === 0 ? <p className="py-2 text-sm text-muted">Esta área no tiene tareas todavía.</p> : null}
              {areaTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 border-b border-line-soft py-2.5">
                  <TaskCheck missionId={mission.id} task={t} editable={canEditTask(user, t)} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`${base}/tareas/${t.id}`} className={`truncate text-sm font-semibold ${t.status === "hecha" ? "text-faint line-through" : "text-ink"} hover:text-brand-700`}>
                      {t.title}
                      {t.isGoCriteria ? <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-warn">Go / No-Go</span> : null}
                    </Link>
                    <span className="text-xs text-faint">{t.ownerName ?? (person ? person.name : "Sin responsable")}</span>
                  </div>
                  <StatusPill status={t.status} />
                  <span className="w-12 text-right">
                    <DueLabel task={t} today={today} />
                  </span>
                </div>
              ))}
            </section>
            {canCreateHere ? (
              <TaskForm
                missionId={mission.id}
                people={people.map((p) => ({ id: p.id, name: p.name, label: `${p.name}${p.area ? ` · ${areaInfo(p.area).short}` : p.organizationName ? ` · ${p.organizationName}` : ""}` }))}
                areas={allowed === "all" ? "all" : allowed!}
                defaultArea={area}
                compact
              />
            ) : null}
          </div>
          <section className="card-tight flex flex-col gap-2 sm:p-5">
            <span className="section-title">Equipo asignado</span>
            <p className="text-xs text-muted">
              Confirmados con rol {AREA_VOLUNTEER_ROLES[area].length ? AREA_VOLUNTEER_ROLES[area].map((r) => labelOf(ROLES, r)).join(" o ") : "asociado"}. El rol se asigna en la ficha de cada persona.
            </p>
            {team.length === 0 ? <p className="text-sm text-muted">Nadie asignado todavía.</p> : null}
            {team.map(({ registration: r, volunteer: v, organization: o }) => (
              <div key={r.id} className="flex items-center justify-between gap-2 border-b border-line-soft py-1.5 text-sm">
                <Link href={`${base}/voluntarios/${r.id}`} className="font-semibold hover:text-brand-700">
                  {v.fullName}
                </Link>
                <span className="text-muted">
                  {o?.name ?? v.organizationOther ?? ""} · {labelOf(ROLES, r.assignedRole ?? r.preferredRole)}
                </span>
              </div>
            ))}
          </section>
        </div>
      </PageBody>
    </>
  );
}

function Stat({ value, label, danger = false }: { value: number | string; label: string; danger?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={`text-[26px] font-extrabold tracking-[-0.02em] ${danger ? "text-danger" : ""}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
