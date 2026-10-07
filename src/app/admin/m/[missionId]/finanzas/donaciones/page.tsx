import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import { DONATION_CATEGORIES, listDonations, listEntries, summarizeDonations } from "@/lib/finance";
import { formatCOP, formatShortDate } from "@/lib/format";
import { canManageFinance, canViewFinance } from "@/lib/permissions";
import { Kpi, Money } from "../finance-bits";
import { DonationForm } from "./donation-form";

export const metadata = { title: "Donaciones" };

export default async function DonationsPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/finanzas/donaciones`);
  if (!canViewFinance(user)) redirect(`/admin/m/${missionId}?denegado=1`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const manage = canManageFinance(user);
  const base = `/admin/m/${mission.id}`;
  const rows = listDonations(await listEntries(mission.id));
  const summary = summarizeDonations(rows);
  const exportHref = `${base}/finanzas/export?categoria=${DONATION_CATEGORIES.join(",")}`;

  return (
    <>
      <PageHeader
        kicker={`${mission.name} · Finanzas`}
        title="Donaciones"
        badge={
          <span className="text-xs text-muted">
            {summary.count} {summary.count === 1 ? "donación" : "donaciones"} · {summary.donors} {summary.donors === 1 ? "donante" : "donantes"}
          </span>
        }
        actions={
          <>
            <a href={exportHref} className="btn-secondary" title="Descarga solo las donaciones de la misión">
              Descargar CSV
            </a>
            <Link href={`${base}/finanzas`} className="btn-secondary">
              ← Finanzas
            </Link>
          </>
        }
      />
      <PageBody>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi label="Dinero recibido" value={formatCOP(summary.received)} sub="Cuenta como ingreso recibido en Finanzas" tone="brand" />
          <Kpi label="En especie (valor estimado)" value={formatCOP(summary.inKind)} sub="Lo que la misión no tendrá que comprar" />
          <Kpi label="Prometidas, sin recibir" value={formatCOP(summary.promised)} sub="Acordadas y pendientes de llegar" />
          <Kpi label="Estimadas en el plan" value={formatCOP(summary.projected)} sub="Proyectadas, sin acuerdo en firme" />
          <Kpi label="Donantes" value={String(summary.donors)} sub="Personas, familias o entidades distintas" />
        </section>

        <p className="text-sm text-muted">
          Las donaciones en dinero suman a los ingresos recibidos de Finanzas; las de especie se registran con su valor estimado para saber qué queda cubierto sin comprar. Los aportes de las personas voluntarias no van aquí: se marcan en la ficha de cada una.
        </p>

        {manage ? <DonationForm missionId={mission.id} /> : null}

        <div className="card-tight overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Quién dona</th>
                <th>Tipo</th>
                <th>Qué donó</th>
                <th>Estado</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-muted">
                    {manage ? "Todavía no hay donaciones. Registra la primera con el formulario de arriba." : "Todavía no hay donaciones registradas."}
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id} data-donation={r.id} data-donor={r.counterparty ?? ""}>
                  <td className="mono whitespace-nowrap text-xs text-muted">{r.entryDate ? formatShortDate(r.entryDate) : "—"}</td>
                  <td className="font-semibold">{r.counterparty || "Sin nombre"}</td>
                  <td>
                    <DonationTypeBadge category={r.category} />
                  </td>
                  <td className="text-sm">
                    <Link href={`${base}/finanzas/${r.id}`} className="hover:text-brand-700" title={manage ? "Editar o eliminar" : "Ver detalle"}>
                      {r.concept}
                    </Link>
                    {r.reference || r.notes ? <span className="block text-xs text-muted">{[r.reference, r.notes].filter(Boolean).join(" · ")}</span> : null}
                  </td>
                  <td>
                    <DonationStatusPill status={r.status} />
                  </td>
                  <td className="text-right">
                    <Money amount={r.amount} kind="ingreso" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}

function DonationTypeBadge({ category }: { category: string }) {
  return category === "donaciones_especie" ? <span className="badge bg-warn-soft text-warn">En especie</span> : <span className="badge bg-brand-100 text-brand-800">Dinero</span>;
}

function DonationStatusPill({ status }: { status: string }) {
  if (status === "ejecutado") return <span className="badge-hecha">Recibida</span>;
  if (status === "comprometido") return <span className="badge-en_curso">Prometida</span>;
  return <span className="badge-pendiente">Proyectada</span>;
}
