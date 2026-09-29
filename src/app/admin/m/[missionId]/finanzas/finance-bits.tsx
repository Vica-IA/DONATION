import { AREAS, FINANCE_KINDS, FINANCE_STATUS, GENERAL_AREA, labelOf } from "@/lib/catalogs";
import { formatCOP } from "@/lib/format";

/** Valor en pesos: los gastos en rojo, los ingresos en verde. */
export function Money({ amount, kind, className = "" }: { amount: number; kind?: string; className?: string }) {
  const color = kind === "gasto" ? "text-danger" : kind === "ingreso" ? "text-brand-700" : amount < 0 ? "text-danger" : "text-ink";
  return <span className={`mono whitespace-nowrap ${color} ${className}`}>{formatCOP(amount)}</span>;
}

export function KindBadge({ kind }: { kind: string }) {
  const cls = kind === "gasto" ? "badge bg-danger-soft text-danger" : "badge bg-brand-100 text-brand-800";
  return <span className={cls}>{labelOf(FINANCE_KINDS, kind)}</span>;
}

export function FinanceStatusPill({ status }: { status: string }) {
  const cls = status === "ejecutado" ? "badge-hecha" : status === "comprometido" ? "badge-en_curso" : "badge-pendiente";
  return <span className={cls}>{labelOf(FINANCE_STATUS, status)}</span>;
}

export function areaLabel(area: string | null | undefined): string {
  if (!area) return "";
  return area === GENERAL_AREA.value ? GENERAL_AREA.short : labelOf(AREAS, area);
}
