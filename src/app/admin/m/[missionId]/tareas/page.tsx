import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { TASK_STATUS, areaInfo } from "@/lib/catalogs";
import { getMissionById } from "@/lib/data";
import { todayBogota } from "@/lib/mission-timeline";
import { canEditTask, taskAreasFor } from "@/lib/permissions";
import { listTasks } from "@/lib/tasks";
import { listAssignableUsers } from "@/lib/users";
import { TaskCard } from "./task-bits";
import { TaskForm } from "./task-form";

export const metadata = { title: "Tablero de tareas" };

export default async function TasksPage({ params, searchParams }: { params: Promise<{ missionId: string }>; searchParams: Promise<{ nueva?: string }> }) {
  const { missionId } = await params;
  const { nueva } = await searchParams;
  const user = await requireUser(`/admin/m/${missionId}/tareas`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const [tasks, people] = await Promise.all([listTasks(mission.id), listAssignableUsers()]);
  const today = todayBogota();
  const areas = taskAreasFor(user);
  const columns = TASK_STATUS.map((s) => ({ ...s, cards: tasks.filter((t) => t.status === s.value) }));

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Tablero de tareas"
        badge={<span className="text-xs text-muted">{tasks.filter((t) => t.status !== "hecha").length} abiertas de {tasks.length}</span>}
        actions={areas ? <a href="?nueva=1#nueva" className="btn-primary">+ Nueva tarea</a> : null}
      />
      <PageBody>
        {areas && nueva ? (
          <div id="nueva">
            <TaskForm
              missionId={mission.id}
              people={people.map((p) => ({ id: p.id, name: p.name, label: `${p.name}${p.area ? ` · ${areaInfo(p.area).short}` : p.organizationName ? ` · ${p.organizationName}` : ""}` }))}
              areas={areas}
            />
          </div>
        ) : null}
        <p className="text-[13px] text-muted">Clic en el botón de cada tarjeta para avanzarla de estado. Abre una tarea para editarla.</p>
        <div className="grid items-start gap-3.5 md:grid-cols-3">
          {columns.map((col) => (
            <div key={col.value} className="flex flex-col gap-2 rounded-2xl bg-sand p-3">
              <div className="flex justify-between px-1.5 py-1">
                <span className="text-[15px] font-extrabold">{col.label}</span>
                <span className="mono text-[13px] text-muted">{col.cards.length}</span>
              </div>
              {col.cards.length === 0 ? <p className="px-1.5 pb-2 text-xs text-faint">Sin tareas.</p> : null}
              {col.cards.map((t) => (
                <TaskCard key={t.id} missionId={mission.id} task={t} today={today} editable={canEditTask(user, t)} />
              ))}
            </div>
          ))}
        </div>
      </PageBody>
    </>
  );
}
