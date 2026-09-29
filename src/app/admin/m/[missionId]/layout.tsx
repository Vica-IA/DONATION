import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { getMissionById, getMissionStats } from "@/lib/data";
import { countOpenTasks } from "@/lib/tasks";
import { listCoordinators } from "@/lib/users";

/** Páginas de una misión: la barra lateral siempre corresponde a la misión de la URL. */
export default async function MissionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const user = await requireUser(`/admin/m/${missionId}`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const [stats, openTasks, coordinators] = await Promise.all([getMissionStats(mission), countOpenTasks(mission.id), listCoordinators()]);
  return (
    <AdminShell user={user} mission={mission} counts={{ volunteers: stats.byStatus.confirmado, openTasks }} coordinators={coordinators}>
      {children}
    </AdminShell>
  );
}
