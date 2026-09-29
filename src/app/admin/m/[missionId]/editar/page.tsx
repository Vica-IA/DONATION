import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { MissionForm } from "@/app/admin/(shell)/misiones/mission-form";

export const metadata = { title: "Editar misión" };

export default async function EditMissionPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  await requirePermission("missions.manage", `/admin/m/${missionId}/editar`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  return (
    <>
      <PageHeader kicker={mission.name} title="Editar misión" />
      <PageBody>
        <div className="mx-auto w-full max-w-3xl">
          <MissionForm mission={mission} />
        </div>
      </PageBody>
    </>
  );
}
