import { getSessionUser } from "@/lib/auth";
import { registrationsToCsv } from "@/lib/csv";
import { getMissionById, listRegistrations } from "@/lib/data";
import { canExport, participantScope } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ missionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (user.mustChangePassword || !canExport(user)) return new Response("Sin permiso", { status: 403 });
  const { missionId } = await ctx.params;
  const mission = await getMissionById(missionId);
  if (!mission) return new Response("Misión no encontrada", { status: 404 });
  const scope = participantScope(user);
  const rows = await listRegistrations(mission, scope.kind === "organization" ? { organizationId: scope.organizationId } : {});
  const csv = registrationsToCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${mission.code}-participantes-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
