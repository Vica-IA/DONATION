import { getSessionUser } from "@/lib/auth";
import { financeEntriesToCsv } from "@/lib/csv";
import { getMissionById } from "@/lib/data";
import { filterEntries, financeFiltersFromParams, listEntries } from "@/lib/finance";
import { canViewFinance } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** CSV de Finanzas. Acepta los mismos filtros de la lista (q, tipo, estado, categoria, area) para descargar solo la vista actual. */
export async function GET(request: Request, ctx: { params: Promise<{ missionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (user.mustChangePassword || !canViewFinance(user)) return new Response("Sin permiso", { status: 403 });
  const { missionId } = await ctx.params;
  const mission = await getMissionById(missionId);
  if (!mission) return new Response("Misión no encontrada", { status: 404 });
  const filters = financeFiltersFromParams(Object.fromEntries(new URL(request.url).searchParams));
  const filtered = Object.values(filters).some(Boolean);
  const csv = financeEntriesToCsv(filterEntries(await listEntries(mission.id), filters));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${mission.code}-finanzas${filtered ? "-filtrado" : ""}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
