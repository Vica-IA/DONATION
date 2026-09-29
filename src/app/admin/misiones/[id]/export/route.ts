import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { registrationsToCsv } from "@/lib/csv";
import { getMissionById, listRegistrations } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (user.mustChangePassword || !can(user.role, "participants.export")) return new Response("Sin permiso", { status: 403 });
  const { id } = await ctx.params;
  const mission = await getMissionById(id);
  if (!mission) return new Response("Misión no encontrada", { status: 404 });
  const rows = await listRegistrations(mission);
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
