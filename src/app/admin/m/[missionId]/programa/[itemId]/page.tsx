import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { formatTime, formatWeekday } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getItineraryItem, missionDays } from "@/lib/program";
import { deleteItemAction } from "../actions";
import { ItemForm } from "../item-form";

export default async function ItemPage({ params }: { params: Promise<{ missionId: string; itemId: string }> }) {
  const { missionId, itemId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/programa/${itemId}`);
  if (!can(user.role, "program.manage")) redirect(`/admin/m/${missionId}?denegado=1`);
  const [mission, item] = await Promise.all([getMissionById(missionId), getItineraryItem(itemId)]);
  if (!mission || !item || item.missionId !== mission.id) notFound();

  return (
    <>
      <PageHeader
        kicker={`${mission.name} · Programa`}
        title={item.title}
        badge={
          <span className="text-xs text-muted capitalize">
            {formatWeekday(item.day)} · {formatTime(item.startTime)}
          </span>
        }
        actions={
          <Link href={`/admin/m/${mission.id}/programa?dia=${item.day}`} className="btn-secondary">
            ← Programa
          </Link>
        }
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <ItemForm missionId={mission.id} item={item} days={missionDays(mission)} defaultDay={item.day} />
          <form action={deleteItemAction.bind(null, mission.id, item.id)} className="card self-start">
            <h2 className="section-title">Eliminar</h2>
            <p className="mb-3 mt-1 text-sm text-muted">Se quita del programa de forma definitiva. La bitácora conserva el registro.</p>
            <button type="submit" className="btn-danger border border-danger/30">
              Eliminar actividad
            </button>
          </form>
        </div>
      </PageBody>
    </>
  );
}
