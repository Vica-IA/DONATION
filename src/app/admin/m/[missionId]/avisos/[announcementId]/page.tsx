import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getAnnouncement } from "@/lib/program";
import { deleteAnnouncementAction } from "../actions";
import { AnnouncementForm } from "../announcement-form";

export default async function AnnouncementPage({ params }: { params: Promise<{ missionId: string; announcementId: string }> }) {
  const { missionId, announcementId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/avisos/${announcementId}`);
  if (!can(user.role, "program.manage")) redirect(`/admin/m/${missionId}?denegado=1`);
  const [mission, announcement] = await Promise.all([getMissionById(missionId), getAnnouncement(announcementId)]);
  if (!mission || !announcement || announcement.missionId !== mission.id) notFound();

  return (
    <>
      <PageHeader
        kicker={`${mission.name} · Avisos`}
        title={announcement.title}
        badge={<span className="text-xs text-muted">Publicado {formatDateTime(announcement.createdAt)}</span>}
        actions={
          <Link href={`/admin/m/${mission.id}/avisos`} className="btn-secondary">
            ← Avisos
          </Link>
        }
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <AnnouncementForm missionId={mission.id} announcement={announcement} />
          <form action={deleteAnnouncementAction.bind(null, mission.id, announcement.id)} className="card self-start">
            <h2 className="section-title">Eliminar</h2>
            <p className="mb-3 mt-1 text-sm text-muted">Desaparece de la página pública de forma definitiva.</p>
            <button type="submit" className="btn-danger border border-danger/30">
              Eliminar aviso
            </button>
          </form>
        </div>
      </PageBody>
    </>
  );
}
