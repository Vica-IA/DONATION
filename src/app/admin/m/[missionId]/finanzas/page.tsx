import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { AREAS, FINANCE_CATEGORIES, FINANCE_KINDS, FINANCE_STATUS, GENERAL_AREA, areaInfo, labelOf } from "@/lib/catalogs";
import { getMissionById } from "@/lib/data";
import { contributionSummary, filterEntries, listEntries, summarizeFinance, sumAmounts, type CategoryLine } from "@/lib/finance";
import { formatCOP, formatShortDate, percent } from "@/lib/format";
import { canManageFinance, canViewFinance } from "@/lib/permissions";
import { listAssignableUsers } from "@/lib/users";
import { EntryForm } from "./entry-form";
import { FinanceStatusPill, KindBadge, Money, areaLabel } from "./finance-bits";

export const metadata = { title: "Finanzas" };

type Props = {
  params: Promise<{ missionId: string }>;
  searchParams: Promise<{ q?: string; tipo?: string; estado?: string; categoria?: string; area?: string; nuevo?: string }>;
};

export default async function FinancePage({ params, searchParams }: Props) {
  const { missionId } = await params;
  const user = await requireUser(`/admin/m/${missionId}/finanzas`);
  if (!canViewFinance(user)) redirect(`/admin/m/${missionId}?denegado=1`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const { q = "", tipo = "", estado = "", categoria = "", area = "", nuevo } = await searchParams;
  const manage = canManageFinance(user);
  const base = `/admin/m/${mission.id}`;

  const [all, aportes, people] = await Promise.all([listEntries(mission.id), contributionSummary(mission), manage ? listAssignableUsers() : Promise.resolve([])]);
  const summary = summarizeFinance(all, aportes);
  const filters = { q, kind: tipo, status: estado, category: categoria, area };
  const filtering = Boolean(q || tipo || estado || categoria || area);
  const rows = filterEntries(all, filters);
  const gastos = summary.porCategoria.filter((l) => l.kind === "gasto");
  const ingresos = summary.porCategoria.filter((l) => l.kind === "ingreso");
  const peopleOptions = people.map((p) => ({ id: p.id, label: `${p.name}${p.area ? ` · ${areaInfo(p.area).short}` : p.organizationName ? ` · ${p.organizationName}` : ""}` }));

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Finanzas"
        badge={
          <span className="text-xs text-muted">
            Balance actual <Money amount={summary.balanceActual} className="font-semibold" /> · {all.length} movimientos
          </span>
        }
        actions={
          <>
            <a href={`${base}/finanzas/export`} className="btn-secondary">
              Descargar CSV
            </a>
            {manage ? (
              <a href="?nuevo=1#nuevo" className="btn-primary">
                + Nuevo movimiento
              </a>
            ) : null}
          </>
        }
      />
      <PageBody>
        {manage && nuevo ? (
          <div id="nuevo">
            <EntryForm missionId={mission.id} people={peopleOptions} defaultKind={tipo === "ingreso" ? "ingreso" : "gasto"} />
          </div>
        ) : null}

        {/* Indicadores */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi label="Presupuesto de gastos" value={formatCOP(summary.gastos.proyectado)} sub={`${gastos.length} categorías`} />
          <Kpi
            label="Gastos ejecutados"
            value={formatCOP(summary.gastos.ejecutado)}
            sub={`${percent(summary.gastos.ejecutado, summary.gastos.proyectado)}% del presupuesto · comprometidos ${formatCOP(summary.gastos.comprometido)}`}
            tone={summary.gastos.disponible < 0 ? "danger" : "default"}
          />
          <Kpi
            label="Disponible del presupuesto"
            value={formatCOP(summary.gastos.disponible)}
            sub={summary.gastos.disponible < 0 ? "Sobreejecución: hay más comprometido y ejecutado que presupuesto." : "Presupuesto − comprometido − ejecutado"}
            tone={summary.gastos.disponible < 0 ? "danger" : "default"}
          />
          <Kpi label="Ingresos proyectados" value={formatCOP(summary.ingresos.proyectado)} sub={`incluye aportes de voluntarios ${formatCOP(aportes.projected)}`} />
          <Kpi
            label="Ingresos recibidos"
            value={formatCOP(summary.ingresos.ejecutado)}
            sub={`${percent(summary.ingresos.ejecutado, summary.ingresos.proyectado)}% de lo proyectado · comprometidos ${formatCOP(summary.ingresos.comprometido)}`}
            tone="brand"
          />
          <Kpi
            label="Balance actual"
            value={formatCOP(summary.balanceActual)}
            sub={`Proyectado al cierre: ${formatCOP(summary.balanceProyectado)}`}
            tone={summary.balanceActual < 0 ? "danger" : "brand"}
          />
        </section>

        {summary.faltante > 0 ? (
          <div className="rounded-xl border border-amber-300 bg-warn-soft px-4 py-3 text-sm text-warn">
            <span className="font-semibold">Falta por recaudar {formatCOP(summary.faltante)}</span> para cubrir el presupuesto de gastos con lo recibido y lo comprometido.
          </div>
        ) : null}

        {/* Presupuesto vs ejecución */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="card-tight flex flex-col gap-3 sm:p-5">
            <div className="flex items-baseline justify-between">
              <span className="section-title">Gastos por categoría</span>
              <span className="mono text-[13px] text-muted">{formatCOP(summary.gastos.proyectado)}</span>
            </div>
            {gastos.length === 0 ? (
              <p className="text-sm text-muted">Sin gastos registrados. Empieza por el presupuesto: registra cada rubro como gasto proyectado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th className="text-right">Presupuesto</th>
                      <th className="text-right">Comprometido</th>
                      <th className="text-right">Ejecutado</th>
                      <th className="text-right">Disponible</th>
                      <th className="w-28">Ejecución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map((l) => (
                      <CategoryRow key={l.category} line={l} base={base} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card-tight flex flex-col gap-3 sm:p-5">
            <div className="flex items-baseline justify-between">
              <span className="section-title">Ingresos por fuente</span>
              <span className="mono text-[13px] text-muted">{formatCOP(summary.ingresos.ejecutado)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fuente</th>
                    <th className="text-right">Proyectado</th>
                    <th className="text-right">Comprometido</th>
                    <th className="text-right">Recibido</th>
                  </tr>
                </thead>
                <tbody>
                  {ingresos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-sm text-muted">
                        Sin ingresos todavía.
                      </td>
                    </tr>
                  ) : null}
                  {ingresos.map((l) => (
                    <tr key={l.category}>
                      <td>
                        {l.automatic ? (
                          <Link href={`${base}/voluntarios`} className="font-semibold hover:text-brand-700">
                            {l.label}
                          </Link>
                        ) : (
                          <Link href={`${base}/finanzas?categoria=${l.category}`} className="font-semibold hover:text-brand-700">
                            {l.label}
                          </Link>
                        )}
                        {l.automatic ? (
                          <span className="block text-xs text-muted">
                            Automático: {aportes.confirmed - aportes.exempt} confirmados × {formatCOP(aportes.perPerson)} · {aportes.paidCount} al día
                          </span>
                        ) : (
                          <span className="block text-xs text-muted">{l.count} movimientos</span>
                        )}
                      </td>
                      <td className="text-right">
                        <span className="mono">{formatCOP(l.proyectado)}</span>
                      </td>
                      <td className="text-right">
                        <span className="mono">{formatCOP(l.comprometido)}</span>
                      </td>
                      <td className="text-right">
                        <Money amount={l.ejecutado} kind="ingreso" className="font-semibold" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              Los aportes de las personas voluntarias se calculan desde sus fichas (aporte pagado, parcial o exento). No los registres aquí.
            </p>
          </div>
        </section>

        {/* Movimientos */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="section-title">Movimientos</span>
            <span className="text-xs text-muted">
              {filtering ? `${rows.length} de ${all.length}` : all.length} · gastos <Money amount={sumAmounts(rows, "gasto")} kind="gasto" /> · ingresos{" "}
              <Money amount={sumAmounts(rows, "ingreso")} kind="ingreso" />
            </span>
          </div>
          <form className="card-tight grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]" method="get">
            <input name="q" className="input" placeholder="Buscar por concepto, proveedor, referencia o notas" defaultValue={q} />
            <select name="tipo" className="input sm:w-36" defaultValue={tipo}>
              <option value="">Gastos e ingresos</option>
              {FINANCE_KINDS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}s
                </option>
              ))}
            </select>
            <select name="estado" className="input sm:w-40" defaultValue={estado}>
              <option value="">Todos los estados</option>
              {FINANCE_STATUS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select name="categoria" className="input sm:w-52" defaultValue={categoria}>
              <option value="">Todas las categorías</option>
              {FINANCE_CATEGORIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select name="area" className="input sm:w-44" defaultValue={area}>
              <option value="">Todas las áreas</option>
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.short}
                </option>
              ))}
              <option value={GENERAL_AREA.value}>{GENERAL_AREA.short}</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="btn-secondary">
                Filtrar
              </button>
              {filtering ? (
                <Link href={`${base}/finanzas`} className="btn-ghost">
                  Limpiar
                </Link>
              ) : null}
            </div>
          </form>

          <div className="card-tight overflow-x-auto p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Área</th>
                  <th>Estado</th>
                  <th className="text-right">Valor</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-muted">
                      {all.length === 0
                        ? manage
                          ? "Todavía no hay movimientos. Registra el presupuesto de la misión con el botón “+ Nuevo movimiento”."
                          : "Todavía no hay movimientos registrados."
                        : "Ningún movimiento coincide con el filtro."}
                    </td>
                  </tr>
                ) : null}
                {rows.map((r) => (
                  <tr key={r.id} data-entry={r.id} data-concept={r.concept}>
                    <td className="mono whitespace-nowrap text-xs text-muted">{r.entryDate ? formatShortDate(r.entryDate) : "—"}</td>
                    <td>
                      <KindBadge kind={r.kind} />
                    </td>
                    <td>
                      <Link href={`${base}/finanzas/${r.id}`} className="font-semibold hover:text-brand-700">
                        {r.concept}
                      </Link>
                      {r.counterparty || r.reference ? (
                        <span className="block text-xs text-muted">
                          {[r.counterparty, r.reference].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-sm">{labelOf(FINANCE_CATEGORIES, r.category)}</td>
                    <td className="text-sm text-muted">{areaLabel(r.area) || "—"}</td>
                    <td>
                      <FinanceStatusPill status={r.status} />
                    </td>
                    <td className="text-right">
                      <Money amount={r.amount} kind={r.kind} className="font-semibold" />
                    </td>
                    <td className="text-sm text-muted">{r.ownerName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            <span className="font-semibold">Cómo se lee:</span> <em>proyectado</em> es el presupuesto o la proyección; <em>comprometido</em>, un acuerdo en firme sin
            movimiento de dinero; <em>ejecutado</em>, dinero ya pagado o recibido. El disponible de cada categoría es su presupuesto menos lo comprometido y lo ejecutado.
          </p>
        </section>
      </PageBody>
    </>
  );
}

function CategoryRow({ line, base }: { line: CategoryLine; base: string }) {
  const used = line.comprometido + line.ejecutado;
  const pct = line.proyectado > 0 ? Math.min(100, Math.round((used / line.proyectado) * 100)) : used > 0 ? 100 : 0;
  const over = line.disponible < 0;
  return (
    <tr>
      <td>
        <Link href={`${base}/finanzas?categoria=${line.category}`} className="font-semibold hover:text-brand-700">
          {line.label}
        </Link>
        <span className="block text-xs text-muted">{line.count} movimientos</span>
      </td>
      <td className="text-right">
        <span className="mono">{formatCOP(line.proyectado)}</span>
      </td>
      <td className="text-right">
        <span className="mono">{formatCOP(line.comprometido)}</span>
      </td>
      <td className="text-right">
        <Money amount={line.ejecutado} kind="gasto" className="font-semibold" />
      </td>
      <td className="text-right">
        <span className={`mono ${over ? "font-semibold text-danger" : ""}`}>{formatCOP(line.disponible)}</span>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
            <div className={`h-full rounded-full ${over ? "bg-danger" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="mono w-9 text-right text-xs text-muted">{pct}%</span>
        </div>
      </td>
    </tr>
  );
}

function Kpi({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "brand" | "danger" }) {
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
