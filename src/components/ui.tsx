import { REGISTRATION_STATUS, labelOf } from "@/lib/catalogs";

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "confirmado" || status === "lista_espera" || status === "pendiente" || status === "cancelado"
      ? `badge-${status}`
      : "badge bg-slate-100 text-ink-soft";
  return <span className={cls}>{labelOf(REGISTRATION_STATUS, status)}</span>;
}

export function Field({
  label,
  htmlFor,
  error,
  help,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {error ? <p className="error">{error}</p> : help ? <p className="help">{help}</p> : null}
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
