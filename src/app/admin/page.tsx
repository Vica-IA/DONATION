import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getActiveMission } from "@/lib/data";

/** /admin → resumen de la misión activa (conserva avisos como ?denegado=1). */
export default async function AdminIndex({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("/admin");
  const params = await searchParams;
  const mission = await getActiveMission();
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  redirect(mission ? `/admin/m/${mission.id}${qs ? `?${qs}` : ""}` : `/admin/misiones${qs ? `?${qs}` : ""}`);
}
