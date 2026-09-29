import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { FINANCE_CATEGORIES, areaInfo, labelOf } from "@/lib/catalogs";
import { getMissionById } from "@/lib/data";
import { getEntry } from "@/lib/finance";
import { formatDate, formatDateTime } from "@/lib/format";
import { canManageFinance, canViewFinance } from "@/lib/permissions";
import { listAssignableUsers } from "@/lib/users";
import { deleteEntryAction } from "../actions";
import { EntryForm } from "../entry-form";
import { FinanceStatusPill, KindBadge, Money, areaLabel } from "../finance-bits";

export default async function FinanceEntryPage({ params }: { params: Promise<{ missionId: string; entryId: string }> }) {
  const { missionId, entryId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/finanzas/${entryId}`);
  if (!canViewFinance(user)) redirect(`/admin/m/${missionId}?denegado=1`);
  const manage = canManageFinance(user);
  const [mission, entry, people] = await Promise.all([getMissionById(missionId), getEntry(entryId), manage ? listAssignableUsers() : Promise.resolve([])]);
  if (!mission || !entry || entry.missionId !== mission.id) notFound();

  return (
    <>
      <PageHeader
        kicker={`${mission.name} · Finanzas`}
        title={entry.concept}
        badge={
          <>
            <KindBadge kind={entry.kind} />
            <FinanceStatusPill status={entry.status} />
            <Money amount={entry.amount} kind={entry.kind} className="text-sm font-semibold" />
          </>
        }
        actions={
          <Link href={`/admin/m/${mission.id}/finanzas`} className="btn-secondary">
            ← Finanzas
          </Link>
        }
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {manage ? (
            <EntryForm
              missionId={mission.id}
              entry={entry}
              people={people.map((p) => ({ id: p.id, label: `${p.name}${p.area ? ` · ${areaInfo(p.area).short}` : p.organizationName ? ` · ${p.organizationName}` : ""}` }))}
            />
          ) : (
            <div className="card space-y-2 text-sm">
              <h2 className="section-title">Movimiento</h2>
              <p>
                <span className="text-muted">Categoría:</span> {labelOf(FINANCE_CATEGORIES, entry.category)}
              </p>
              <p>
                <span className="text-muted">Fecha:</span> {entry.entryDate ? formatDate(entry.entryDate) : "Sin fecha"}
              </p>
              <p>
                <span className="text-muted">Área:</span> {areaLabel(entry.area) || "Sin área"}
              </p>
              {entry.counterparty ? (
                <p>
                  <span className="text-muted">{entry.kind === "gasto" ? "Proveedor" : "Donante o entidad"}:</span> {entry.counterparty}
                </p>
              ) : null}
              {entry.reference ? (
                <p>
                  <span className="text-muted">Referencia:</span> {entry.reference}
                </p>
              ) : null}
              {entry.notes ? <p className="rounded-lg bg-paper-2 p-3">{entry.notes}</p> : null}
              <p className="text-xs text-muted">Solo el administrador y la coordinación de Financiero pueden editar movimientos.</p>
            </div>
          )}
          <div className="space-y-5">
            <div className="card space-y-2 text-sm">
              <h2 className="section-title">Detalle</h2>
              <p>
                <span className="text-muted">Responsable:</span> {entry.ownerName ?? "Coordinación financiera"}
              </p>
              <p>
                <span className="text-muted">Registrado:</span> {formatDateTime(entry.createdAt)}
                {entry.createdBy ? ` por ${entry.createdBy}` : ""}
              </p>
              {entry.updatedAt !== entry.createdAt ? (
                <p>
                  <span className="text-muted">Última edición:</span> {formatDateTime(entry.updatedAt)}
                </p>
              ) : null}
            </div>
            {manage ? (
              <form action={deleteEntryAction.bind(null, mission.id, entry.id)} className="card">
                <h2 className="section-title">Eliminar</h2>
                <p className="mb-3 mt-1 text-sm text-muted">Se borra el movimiento de forma definitiva. La bitácora conserva el registro.</p>
                <button type="submit" className="btn-danger border border-danger/30">
                  Eliminar movimiento
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </PageBody>
    </>
  );
}
