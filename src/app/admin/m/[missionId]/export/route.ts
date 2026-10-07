import { getSessionUser } from "@/lib/auth";
import { registrationsToCsv } from "@/lib/csv";
import { getMissionById, listRegistrations, registrationFiltersFromParams } from "@/lib/data";
import { canExport, participantScope } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** CSV de voluntarios. Acepta los mismos filtros de la lista (q, estado, grupo, requisito) para descargar solo la vista actual. */
export async function GET(request: Request, ctx: { params: Promise<{ missionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (user.mustChangePassword || !canExport(user)) return new Response("Sin permiso", { status: 403 });
  const { missionId } = await ctx.params;
  const mission = await getMissionById(missionId);
  if (!mission) return new Response("Misión no encontrada", { status: 404 });
  const filters = registrationFiltersFromParams(Object.fromEntries(new URL(request.url).searchParams));
  const scope = participantScope(user);
  if (scope.kind === "organization") filters.organizationId = scope.organizationId; // un líder solo exporta su grupo
  const filtered = Boolean(filters.q || filters.status || filters.requisito || (scope.kind !== "organization" && filters.organizationId));
  const rows = await listRegistrations(mission, filters);
  const csv = registrationsToCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${mission.code}-participantes${filtered ? "-filtrado" : ""}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
