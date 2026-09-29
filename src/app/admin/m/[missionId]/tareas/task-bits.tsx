import Link from "next/link";
import { TASK_STATUS, areaInfo, labelOf } from "@/lib/catalogs";
import { formatShortDate } from "@/lib/format";
import type { TaskRow } from "@/lib/tasks";
import { advanceTaskAction, toggleTaskAction } from "./actions";

export function AreaDot({ area, withLabel = true }: { area: string; withLabel?: boolean }) {
  const a = areaInfo(area);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: a.color }}>
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: a.color }} />
      {withLabel ? a.short : null}
    </span>
  );
}

export function DueLabel({ task, today }: { task: TaskRow; today: string }) {
  if (!task.dueDate) return <span className="mono text-xs text-faint">—</span>;
  const overdue = task.status !== "hecha" && task.dueDate < today;
  return <span className={`mono whitespace-nowrap text-xs ${overdue ? "font-semibold text-danger" : "text-muted"}`}>{formatShortDate(task.dueDate)}</span>;
}

/** Nombre del responsable o, en su defecto, la coordinación del área. */
export function defaultOwner(area: string): string {
  return area === "general" ? "Dirección de misión" : `Coordinación de ${areaInfo(area).short}`;
}

export function OwnerLabel({ task }: { task: TaskRow }) {
  return <span className="text-xs text-muted">{task.ownerName ?? defaultOwner(task.area)}</span>;
}

/** Casilla hecha / pendiente. Si no puede editar, solo muestra el estado. */
export function TaskCheck({ missionId, task, editable }: { missionId: string; task: TaskRow; editable: boolean }) {
  const done = task.status === "hecha";
  const box = <span className={`check ${done ? "check-on" : ""}`}>{done ? "✓" : ""}</span>;
  if (!editable) return box;
  return (
    <form action={toggleTaskAction.bind(null, missionId, task.id)}>
      <button type="submit" className="cursor-pointer" title={done ? "Marcar pendiente" : "Marcar hecha"} aria-label={done ? "Marcar pendiente" : "Marcar hecha"}>
        {box}
      </button>
    </form>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls = status === "hecha" ? "badge-hecha" : status === "en_curso" ? "badge-en_curso" : "badge-pendiente";
  return <span className={cls}>{labelOf(TASK_STATUS, status)}</span>;
}

/** Tarjeta del tablero: avanzar de estado con un clic. */
export function TaskCard({ missionId, task, today, editable }: { missionId: string; task: TaskRow; today: string; editable: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(16,35,29,.08)]" data-task-card={task.id} data-title={task.title}>
      <div className="flex items-center justify-between gap-2">
        <AreaDot area={task.area} />
        {task.isGoCriteria ? <span className="rounded-md bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn">Go / No-Go</span> : null}
      </div>
      <Link href={`/admin/m/${missionId}/tareas/${task.id}`} className="text-sm font-semibold leading-snug hover:text-brand-700">
        {task.title}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <OwnerLabel task={task} />
        <DueLabel task={task} today={today} />
      </div>
      {editable ? (
        <form action={advanceTaskAction.bind(null, missionId, task.id)}>
          <button type="submit" className="w-full rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-paper-2">
            {task.status === "pendiente" ? "Empezar →" : task.status === "en_curso" ? "Marcar hecha ✓" : "Reabrir"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
