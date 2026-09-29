import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { MissionForm } from "../mission-form";

export default async function NewMissionPage() {
  await requirePermission("missions.manage", "/admin/misiones/nueva");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-slate-500 hover:text-brand-700">
          ← Misiones
        </Link>
        <h1 className="text-2xl font-bold">Nueva misión</h1>
      </div>
      <MissionForm mission={null} />
    </div>
  );
}
