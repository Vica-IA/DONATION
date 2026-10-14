import Link from "next/link";
import { formatCOP } from "@/lib/format";

/** Valor en pesos en monoespaciado: in = verde, out = rojo, warn = ámbar. */
export function Money({ amount, tone = "neutral", className = "" }: { amount: number; tone?: "in" | "out" | "warn" | "neutral" | "auto"; className?: string }) {
  const t = tone === "auto" ? (amount < 0 ? "out" : "neutral") : tone;
  const color = t === "out" ? "text-danger" : t === "in" ? "text-brand-800" : t === "warn" ? "text-warn" : "text-ink";
  return <span className={`mono whitespace-nowrap ${color} ${className}`}>{formatCOP(amount)}</span>;
}

export function Kpi({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "brand" | "danger" | "warn" }) {
  const box = tone === "brand" ? "border-brand-200 bg-brand-50" : tone === "danger" ? "border-red-200 bg-red-50" : tone === "warn" ? "border-accent-500 bg-warn-soft" : "border-line bg-paper-2";
  const text = tone === "brand" ? "text-brand-800" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${box}`}>
      <p className="kpi-label">{label}</p>
      <p className={`mono mt-0.5 text-[17px] font-semibold ${text}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

/** Pastilla de estado. */
export function Pill({ tone, children, className = "" }: { tone: "ok" | "warn" | "muted" | "danger" | "info"; children: React.ReactNode; className?: string }) {
  const cls = tone === "ok" ? "bg-brand-100 text-brand-800" : tone === "warn" ? "bg-warn-soft text-warn" : tone === "danger" ? "bg-danger-soft text-danger" : tone === "info" ? "bg-[#dde8f3] text-[#1f4f7a]" : "bg-sand text-ink-soft";
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls} ${className}`}>{children}</span>;
}

/** Filtro de una lista (enlace que conserva el resto de la URL). */
export function FilterChip({ href, on, label, dot }: { href: string; on: boolean; label: string; dot?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:bg-paper-2"}`}>
      {dot ? <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? "#fff" : dot }} /> : null}
      {label}
    </Link>
  );
}
