import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { listAnnouncements } from "@/lib/program";
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
            <article key={a.id} className="card-tight" data-announcement-title={a.title}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {a.pinned ? <span className="badge-en_curso">Fijado</span> : null}
                  {manage ? (
                    <Link href={`${base}/avisos/${a.id}`} className="text-[15px] font-bold hover:text-brand-700">
                      {a.title}
                    </Link>
                  ) : (
                    <span className="text-[15px] font-bold">{a.title}</span>
                  )}
                </div>
                <span className="text-xs text-faint">
                  {formatDateTime(a.createdAt)}
                  {a.createdBy ? ` · ${a.createdBy}` : ""}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{a.body}</p>
            </article>
          ))}
        </section>
      </PageBody>
    </>
  );
}
