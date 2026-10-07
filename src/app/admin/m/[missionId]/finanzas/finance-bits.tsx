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

export function Kpi({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "brand" | "danger" }) {
  const box = tone === "brand" ? "border-brand-200 bg-brand-50" : tone === "danger" ? "border-red-200 bg-red-50" : "border-line bg-white";
  const text = tone === "brand" ? "text-brand-800" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div className={`rounded-2xl border p-4 ${box}`}>
      <p className="kpi-label">{label}</p>
      <p className={`mono mt-1 text-2xl font-extrabold tracking-tight ${text}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}
