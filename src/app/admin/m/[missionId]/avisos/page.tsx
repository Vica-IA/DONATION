import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { listAnnouncements } from "@/lib/program";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteAnnouncementAction } from "./actions";
import { AnnouncementForm } from "./announcement-form";

export const metadata = { title: "Avisos" };

export default async function AnnouncementsPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/avisos`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const manage = can(user.role, "program.manage");
  const list = await listAnnouncements(mission.id);
  const base = `/admin/m/${mission.id}`;

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Avisos"
        badge={<span className="text-xs text-muted">{list.length} publicados · visibles en la página pública</span>}
        actions={
          <a href={`/misiones/${mission.slug}`} className="btn-secondary" target="_blank" rel="noopener noreferrer">
            Ver página pública
          </a>
        }
      />
      <PageBody>
        {manage ? <AnnouncementForm missionId={mission.id} /> : null}
        <section className="flex flex-col gap-3">
          {list.length === 0 ? <p className="card text-sm text-muted">Todavía no hay avisos.</p> : null}
          {list.map((a) => (
            <article key={a.id} className="card-tight flex flex-col gap-2 sm:px-[18px]" data-announcement-title={a.title}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {a.pinned ? <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn">Fijado</span> : null}
                  {manage ? (
                    <Link href={`${base}/avisos/${a.id}`} className="text-[15px] font-bold hover:text-brand-700">
                      {a.title}
                    </Link>
                  ) : (
                    <span className="text-[15px] font-bold">{a.title}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-faint">
                    {formatDateTime(a.createdAt)}
                    {a.createdBy ? ` · ${a.createdBy}` : ""}
                  </span>
                  {manage ? (
                    <form action={deleteAnnouncementAction.bind(null, mission.id, a.id)}>
                      <ConfirmButton message={`¿Eliminar el aviso "${a.title}"? Desaparece de la página pública.`} className="text-xs font-semibold text-danger hover:underline">
                        Eliminar
                      </ConfirmButton>
                    </form>
                  ) : null}
                </div>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{a.body}</p>
            </article>
          ))}
        </section>
      </PageBody>
    </>
  );
}
