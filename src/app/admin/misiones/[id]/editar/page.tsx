import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { MissionForm } from "../../mission-form";

export default async function EditMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/misiones/${id}/editar`);
  const mission = await getMissionById(id);
  if (!mission) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/admin/misiones/${mission.id}`} className="text-xs text-slate-500 hover:text-brand-700">
          ← {mission.name}
        </Link>
        <h1 className="text-2xl font-bold">Editar misión</h1>
      </div>
      <MissionForm mission={mission} />
    </div>
  );
}
