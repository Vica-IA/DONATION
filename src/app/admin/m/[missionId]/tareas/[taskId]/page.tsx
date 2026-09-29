import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { areaInfo } from "@/lib/catalogs";
import { getMissionById } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { canEditTask, taskAreasFor } from "@/lib/permissions";
import { getTask } from "@/lib/tasks";
import { listAssignableUsers } from "@/lib/users";
import { deleteTaskAction } from "../actions";
import { AreaDot, StatusPill, defaultOwner } from "../task-bits";
import { TaskForm } from "../task-form";

export default async function TaskPage({ params }: { params: Promise<{ missionId: string; taskId: string }> }) {
  const { missionId, taskId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/tareas/${taskId}`);
  const [mission, task, people] = await Promise.all([getMissionById(missionId), getTask(taskId), listAssignableUsers()]);
  if (!mission || !task || task.missionId !== mission.id) notFound();
  const editable = canEditTask(user, task);
  const areas = taskAreasFor(user);

  return (
    <>
      <PageHeader
        kicker={`${mission.name} · Tareas`}
        title={task.title}
        badge={
          <>
            <AreaDot area={task.area} />
            <StatusPill status={task.status} />
          </>
        }
        actions={
          <Link href={`/admin/m/${mission.id}/tareas`} className="btn-secondary">
            ← Tablero
          </Link>
        }
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {editable ? (
            <TaskForm
              missionId={mission.id}
              task={task}
              people={people.map((p) => ({ id: p.id, name: p.name, label: `${p.name}${p.area ? ` · ${areaInfo(p.area).short}` : p.organizationName ? ` · ${p.organizationName}` : ""}` }))}
              areas={areas === null || areas === "all" ? "all" : areas}
            />
          ) : (
            <div className="card text-sm text-muted">Solo el administrador, el responsable o el coordinador del área pueden editar esta tarea.</div>
          )}
          <div className="space-y-5">
            <div className="card space-y-2 text-sm">
              <h2 className="section-title">Detalle</h2>
              <p>
                <span className="text-muted">Responsable:</span> {task.ownerName ?? defaultOwner(task.area)}
              </p>
              <p>
                <span className="text-muted">Creada:</span> {formatDateTime(task.createdAt)}
                {task.createdBy ? ` por ${task.createdBy}` : ""}
              </p>
              {task.completedAt ? (
                <p>
                  <span className="text-muted">Hecha:</span> {formatDateTime(task.completedAt)}
                </p>
              ) : null}
              {task.notes ? <p className="rounded-lg bg-paper-2 p-3">{task.notes}</p> : null}
            </div>
            {editable ? (
              <form action={deleteTaskAction.bind(null, mission.id, task.id)} className="card">
                <h2 className="section-title">Eliminar</h2>
                <p className="mb-3 mt-1 text-sm text-muted">Se borra la tarea de forma definitiva. La bitácora conserva el registro.</p>
                <button type="submit" className="btn-danger border border-danger/30">
                  Eliminar tarea
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </PageBody>
    </>
  );
}
