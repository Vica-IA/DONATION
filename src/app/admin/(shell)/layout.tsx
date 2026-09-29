import { AdminShell } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { getActiveMission, getMissionStats } from "@/lib/data";
import { countOpenTasks } from "@/lib/tasks";
import { listCoordinators } from "@/lib/users";

/** Páginas globales del panel (misiones, usuarios, cuenta): barra lateral con la misión activa. */
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin", { allowPendingPassword: true });
  const mission = await getActiveMission();
  const [counts, coordinators] = await Promise.all([
    mission ? Promise.all([getMissionStats(mission), countOpenTasks(mission.id)]).then(([s, t]) => ({ volunteers: s.byStatus.confirmado, openTasks: t })) : null,
    listCoordinators(),
  ]);
  return (
    <AdminShell user={user} mission={mission} counts={counts} coordinators={coordinators}>
      {children}
    </AdminShell>
  );
}
