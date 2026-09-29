import { isAdmin } from "@/lib/auth";
import { registrationsToCsv } from "@/lib/csv";
import { getMissionById, listRegistrations } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("No autorizado", { status: 401 });
  const { id } = await ctx.params;
  const mission = await getMissionById(id);
  if (!mission) return new Response("Misión no encontrada", { status: 404 });
  const rows = await listRegistrations(mission.id);
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
