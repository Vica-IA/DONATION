import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { Modal } from "@/components/modal";
import { requireUser } from "@/lib/auth";
import { FINANCE_CATEGORIES, WISH_CATEGORIES, labelOf, type ExpenseStatus } from "@/lib/catalogs";
import { getMissionById, listOrganizations } from "@/lib/data";
import { expenseStatusOf, financeModel, financeSummaryText, incomeStatusOf, payText, wishCategoryInfo, type FinanceModel } from "@/lib/finance";
import { formatCOP, formatShortDate, percent, toQuery } from "@/lib/format";
import { canManageFinance, canViewFinance } from "@/lib/permissions";
import { listAssignableUsers } from "@/lib/users";
import { cycleExpenseStatusAction, deleteEntryAction, deleteWishItemAction, moveWishItemAction, returnWishItemAction, toggleIncomeStatusAction } from "./actions";
import { FilterChip, Money, Pill } from "./finance-bits";
import { BuyForm, ExpenseForm, FundsPanel, IncomeForm, ReimburseForm, TransferForm, WishForm, type FundOption, type VolunteerOption } from "./modals";

export const metadata = { title: "Finanzas" };

type Params = { ingresos?: string; gastos?: string; lista?: string; nuevo?: string; comprar?: string; traslado?: string; cuentas?: string; reembolso?: string; msg?: string };
type Props = { params: Promise<{ missionId: string }>; searchParams: Promise<Params> };

const money = formatCOP;

/** Fila de una lista: en móvil, texto y pastillas arriba y el valor abajo; en pantallas anchas, valor | texto | pastillas. */
const ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 px-4 py-2.5 sm:grid-cols-[118px_minmax(0,1fr)_auto] sm:gap-3 sm:px-[18px]";
const AMOUNT = "order-3 col-span-2 text-left sm:order-none sm:col-span-1 sm:text-right";

export default async function FinancePage({ params, searchParams }: Props) {
  const { missionId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/admin/m/${missionId}/finanzas`);
  if (!canViewFinance(user)) redirect(`/admin/m/${missionId}?denegado=1`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const manage = canManageFinance(user);
  const [model, orgs, assignable] = await Promise.all([financeModel(mission), listOrganizations(), manage ? listAssignableUsers() : Promise.resolve([])]);
  const t = model.totals;
  const base = `/admin/m/${mission.id}`;
  const incF = sp.ingresos || "todos";
  const expF = sp.gastos || "todas";
  const wishF = sp.lista || "todas";
  const filters = { ingresos: sp.ingresos, gastos: sp.gastos, lista: sp.lista };
  const href = (extra: Record<string, string | undefined>) => `${base}/finanzas${toQuery({ ...filters, ...extra })}`;
  const returnTo = href({});
  const closeHref = returnTo;
  const people = [...new Set([...model.funds.filter((f) => f.active).map((f) => f.ownerName), ...assignable.map((u) => u.name), user.name])];
  const fundOptions: FundOption[] = model.funds.map((f) => ({ id: f.id, label: f.label, ownerName: f.ownerName, type: f.type, balance: f.balance, active: f.active }));
  const volunteerOptions: VolunteerOption[] = model.volunteers.map((v) => ({
    id: v.registrationId,
    label: `${v.name} · ${v.kind === "recibido" ? "ya recibido" : v.kind === "parcial" ? "pago parcial" : v.kind === "exento" ? "exento" : "pendiente"}`,
  }));
  const groups = orgs.map((o) => o.name);
  const common = { missionId: mission.id, returnTo, closeHref, funds: fundOptions, people, me: user.name };

  // ----- Lectura del plan -----
  const steps = [
    { op: "", label: "Ingresos *", value: t.incTotal, note: `${money(t.incRec)} recibidos` },
    { op: "−", label: "Gastos fijos", value: t.fijos, note: `${money(t.fijosPagados)} pagados` },
    { op: "=", label: "Presupuesto disponible", value: t.disponible, note: "tras cubrir los fijos", danger: t.disponible < 0 },
    { op: "−", label: "Ejecutado variable", value: t.variables, note: "actividades y compras hechas" },
    { op: "−", label: "Lista pendiente", value: t.wishPending, note: `${t.pendingCount} ítems por comprar` },
    { op: "=", label: t.saldoTotal < 0 ? "Meta de recaudo" : "Saldo total", value: Math.abs(t.saldoTotal), note: t.saldoTotal < 0 ? "falta por recaudar" : "sobrante", final: true },
  ];
  const coverPct = percent(t.incTotal, t.fijos);
  const coverText = t.incTotal >= t.fijos ? `Gastos fijos cubiertos · quedan ${money(t.disponible)} de presupuesto disponible` : `Los ingresos cubren ${coverPct}% de los gastos fijos · faltan ${money(t.fijos - t.incTotal)}`;

  // ----- Ingresos -----
  const vols = model.volunteers;
  const volRec = vols.filter((v) => v.kind === "recibido").length;
  const volPend = vols.filter((v) => v.kind === "estimado" || v.kind === "parcial").length;
  const volTotal = vols.reduce((acc, v) => acc + Math.max(v.expected, v.received), 0);
  const showVols = incF === "todos" || incF === "voluntarios";
  const otherIncomes = model.incomes.filter((e) => incF === "todos" || (incF === "grupos" && e.source === "grupo") || (incF === "externos" && e.source !== "grupo"));

  // ----- Gastos -----
  type Item = { id: string; category: string; amount: number; concept: string; sub: string; pay: string; payPending: boolean; status: ExpenseStatus | "comprado"; fromWish: boolean; reimbursable: boolean };
  const items: Item[] = [
    ...model.expenses.map(
      (e): Item => ({
        id: e.id,
        category: e.category,
        amount: e.amount,
        concept: e.concept,
        sub: [e.sub, e.counterparty].filter(Boolean).join(" · "),
        pay: payText(e, model.fundLabel),
        payPending: e.payKind === "person" && !e.reimbursedFundId,
        status: expenseStatusOf(e),
        fromWish: false,
        reimbursable: e.status === "ejecutado" && e.payKind === "person" && !e.reimbursedFundId,
      }),
    ),
    ...model.wish
      .filter((w) => w.status === "comprado")
      .map(
        (w): Item => ({
          id: w.id,
          category: "materiales",
          amount: w.total,
          concept: w.name,
          sub: [w.detail, "desde la lista de compras"].filter(Boolean).join(" · "),
          pay: `Pagado desde ${model.fundLabel(w.fundId)}${w.boughtBy ? ` · por ${w.boughtBy}` : ""}${w.reference ? ` · ${w.reference}` : ""}`,
          payPending: false,
          status: "comprado",
          fromWish: true,
          reimbursable: false,
        }),
      ),
  ];
  const expenseCats = FINANCE_CATEGORIES.filter((c) => c.kind === "gasto");
  const usedCats = expenseCats.filter((c) => items.some((i) => i.category === c.value));
  const expenseGroups = usedCats
    .filter((c) => expF === "todas" || expF === c.value)
    .map((c) => {
      const list = items.filter((i) => i.category === c.value);
      return { ...c, fixed: list.some((i) => model.expenses.find((e) => e.id === i.id && (e.budgetKind ? e.budgetKind === "fijo" : true)) !== undefined) && Boolean((c as { fijo?: boolean }).fijo), items: list, subtotal: list.reduce((a, i) => a + i.amount, 0) };
    });
  const payBreakdown = [
    ...model.funds
      .map((f) => {
        const paid = model.expenses.filter((e) => e.status === "ejecutado" && e.payKind === "fund" && e.fundId === f.id);
        const bought = model.wish.filter((w) => w.status === "comprado" && w.fundId === f.id);
        return { label: f.label, value: paid.reduce((a, e) => a + e.amount, 0) + bought.reduce((a, w) => a + w.total, 0), n: paid.length + bought.length, warn: false };
      })
      .filter((x) => x.n > 0),
    ...[...new Set(model.expenses.filter((e) => e.status === "ejecutado" && e.payKind === "person" && !e.reimbursedFundId).map((e) => e.payPerson ?? "—"))].map((p) => ({
      label: `Reembolso pendiente a ${p}`,
      value: model.expenses.filter((e) => e.status === "ejecutado" && e.payKind === "person" && !e.reimbursedFundId && (e.payPerson ?? "—") === p).reduce((a, e) => a + e.amount, 0),
      n: 1,
      warn: true,
    })),
  ];

  // ----- Lista de compras -----
  const wishRows = model.wish.map((w, idx) => ({ w, n: idx + 1 })).filter(({ w }) => wishF === "todas" || w.category === wishF);
  const coveredW = percent(t.coveredSum, t.wishPending);

  // ----- Tesorería -----
  const owners = [...new Set(model.funds.map((f) => f.ownerName))];
  const treasury = owners
    .map((o) => {
      const fs = model.funds.filter((f) => f.ownerName === o && (f.active || f.balance !== 0));
      return { owner: o, funds: fs, total: fs.reduce((a, f) => a + f.balance, 0) };
    })
    .filter((x) => x.funds.length > 0);

  const buyItem = sp.comprar ? model.wish.find((w) => w.id === sp.comprar && w.status !== "comprado") : null;
  const reimburseEntry = sp.reembolso ? model.expenses.find((e) => e.id === sp.reembolso && e.payKind === "person" && !e.reimbursedFundId) : null;

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Finanzas y donaciones"
        badge={<span className="text-xs text-muted">{t.meta > 0 ? `Meta de recaudo ${money(t.meta)}` : `Lista cubierta · sobran ${money(t.saldoTotal)}`}</span>}
        actions={
          <a href={`${base}/finanzas/export`} className="btn-secondary" title="Descarga los ingresos y gastos registrados">
            Descargar CSV
          </a>
        }
      />
      <PageBody>
        {/* Lectura del plan */}
        <section className="flex flex-col gap-[18px] rounded-[20px] bg-brand-900 p-5 text-paper sm:p-6" data-plan>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#a9c9bd]">Lectura del plan</span>
            <span className="max-w-[640px] text-[13px] text-[#cfe3db]">Los ingresos cubren primero los gastos fijos. Lo que sobra compra la lista de materiales y donaciones en orden de prioridad; lo que falta se vuelve la meta de recaudo.</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {steps.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-[18px] text-center text-[22px] font-medium text-[#7fa99a]">{s.op}</span>
                <div
                  className={`flex min-w-[150px] flex-col gap-0.5 rounded-[14px] px-3.5 py-3 ${s.final ? (t.saldoTotal < 0 ? "bg-accent-500 text-ink" : "bg-brand-100 text-ink") : s.danger ? "bg-danger-soft text-danger" : "bg-white/10 text-paper"}`}
                  data-step={s.label}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-80">{s.label}</span>
                  <span className="mono whitespace-nowrap text-[17px] font-semibold">{money(s.value)}</span>
                  <span className="text-[11px] opacity-75">{s.note}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3 text-xs text-[#cfe3db]">
              <span>{coverText}</span>
              <span className="mono">{coverPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div className={`h-full rounded-full ${t.incTotal >= t.fijos ? "bg-brand-300" : "bg-accent-500"}`} style={{ width: `${coverPct}%` }} />
            </div>
          </div>
        </section>

        {sp.msg ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800" role="status" data-flash>
            {sp.msg}
          </div>
        ) : null}

        {/* Tesorería */}
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-4 py-4 sm:px-[18px]">
            <div className="flex flex-col">
              <span className="section-title">Tesorería · saldos por cuenta</span>
              <span className="text-xs text-muted">Solo cuenta lo recibido y lo pagado. Cada movimiento guarda quién lo hizo.</span>
            </div>
            {manage ? (
              <div className="flex w-full gap-2 sm:w-auto">
                <Link href={href({ cuentas: "1" })} className="btn-secondary flex-1 sm:flex-none">
                  Configurar cuentas
                </Link>
                <Link href={href({ traslado: "1" })} className="btn-secondary flex-1 sm:flex-none">
                  ⇄ Traslado entre cuentas
                </Link>
              </div>
            ) : null}
          </div>
          {treasury.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted sm:px-[18px]">Todavía no hay cuentas de tesorería. {manage ? "Crea una por cada responsable con “Configurar cuentas”." : ""}</p>
          ) : (
            <div className="grid gap-px bg-line sm:grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
              {treasury.map((o) => (
                <div key={o.owner} className="flex flex-col gap-2.5 bg-white px-4 py-4 sm:px-[18px]" data-treasurer={o.owner}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent-600 text-[13px] font-bold text-white">{o.owner.slice(0, 2).toUpperCase()}</span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-bold">{o.owner}</span>
                      <span className="text-xs text-muted">Responsable de tesorería</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="kpi-label">Saldo</span>
                      <Money amount={o.total} tone="auto" className="text-lg font-semibold" />
                    </div>
                  </div>
                  {o.funds.map((f) => (
                    <div key={f.id} className="flex flex-col gap-2 rounded-xl border border-line px-3 py-2.5" data-fund-balance={f.label}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-bold">
                          {f.type === "banco" ? "Banco" : "Efectivo"} <span className="text-xs font-normal text-faint">· {f.label}</span>
                        </span>
                        <Money amount={f.balance} tone={f.balance < 0 ? "out" : "in"} className="text-sm font-semibold" />
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-sand">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent(f.balance, f.received)}%` }} />
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
                        <span>
                          Ingresado <b className="mono font-semibold text-ink">{money(f.received)}</b>
                        </span>
                        <span>
                          Gastado <b className="mono font-semibold text-ink">{money(f.spent)}</b>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2 border-t border-line bg-paper-2 px-4 py-3 text-[13px] sm:px-[18px]">
            <span className="text-muted">
              Bancario <b className="mono font-semibold text-ink">{money(t.bank)}</b>
            </span>
            <span className="text-muted">
              Efectivo <b className="mono font-semibold text-ink">{money(t.cash)}</b>
            </span>
            <span className="font-extrabold">
              Disponible total <b className="mono font-semibold">{money(t.bank + t.cash)}</b>
            </span>
            {t.reimbPending > 0 ? (
              <span className="font-semibold text-warn">
                Reembolsos pendientes <b className="mono">{money(t.reimbPending)}</b>
              </span>
            ) : null}
          </div>
          <div className="border-t border-line">
            <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted sm:px-[18px]">Últimos movimientos · quién los hizo</div>
            {model.moves.length === 0 ? <p className="px-4 pb-4 text-sm text-muted sm:px-[18px]">Todavía no hay movimientos de dinero.</p> : null}
            {model.moves.map((m, i) => (
              <div key={`${m.type}-${i}`} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-line-soft px-4 py-2 text-[13px] sm:px-[18px]">
                <span className="mono text-[11px] text-faint">{m.date ? formatShortDate(m.date) : "—"}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Pill tone={m.type === "Ingreso" ? "ok" : m.type === "Gasto" ? "danger" : m.type === "Compra" ? "warn" : "info"}>{m.type}</Pill>
                    <span className="truncate font-semibold">{m.concept}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {m.fund} · por <b className="text-ink-soft">{m.by ?? "—"}</b>
                  </span>
                </div>
                <Money amount={m.amount} tone={m.type === "Ingreso" ? "in" : m.type === "Traslado" ? "neutral" : "out"} className="text-[13px] font-semibold" />
              </div>
            ))}
          </div>
        </section>

        {/* Ingresos y gastos */}
        <section className="grid items-start gap-4 xl:grid-cols-2">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white" data-incomes>
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-4 py-4 sm:px-[18px]">
              <div className="flex flex-col">
                <span className="section-title">Ingresos</span>
                <span className="text-xs text-muted">Aportes de voluntarios, grupos y fuentes externas</span>
              </div>
              {manage ? (
                <Link href={href({ nuevo: "ingreso" })} className="btn-primary w-full sm:w-auto">
                  + Registrar ingreso
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5 border-b border-line-soft px-4 py-2.5 sm:px-[18px]">
              {[
                ["todos", "Todos"],
                ["voluntarios", "Voluntarios"],
                ["grupos", "Grupos"],
                ["externos", "Externos"],
              ].map(([v, l]) => (
                <FilterChip key={v} href={href({ ingresos: v === "todos" ? undefined : v })} on={incF === v} label={l} />
              ))}
            </div>
            {showVols ? (
              <details className="border-b border-line-soft" open={incF === "voluntarios"}>
                <summary className={`${ROW} cursor-pointer list-none hover:bg-paper-2`}>
                  <span className={`mono text-sm font-semibold ${AMOUNT}`}>
                    {money(volTotal)}
                    {volPend ? " *" : ""}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">Aportes de voluntarios ({vols.length})</span>
                    <span className="text-xs text-muted">
                      {volRec} recibidos · {volPend} por recibir · {money(model.perPerson)} por persona
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Pill tone="muted">Voluntarios</Pill>
                    <Pill tone={volPend ? "warn" : "ok"}>{volPend ? `${volPend} pendientes` : "Completo"}</Pill>
                  </div>
                </summary>
                <div className="grid gap-1 px-4 pb-3 sm:grid-cols-2 sm:px-[18px]">
                  {vols.length === 0 ? <p className="text-xs text-muted">Todavía no hay personas confirmadas.</p> : null}
                  {vols.map((v) => (
                    <div key={v.registrationId} className="flex items-center justify-between gap-2 rounded-lg bg-paper-2 px-2 py-1.5 text-xs" data-volunteer-contribution={v.name}>
                      <span className="flex min-w-0 flex-col">
                        <Link href={`${base}/voluntarios/${v.registrationId}`} className="truncate font-semibold hover:text-brand-700">
                          {v.name}
                        </Link>
                        <span className="text-[11px] text-faint">{v.kind === "recibido" || v.kind === "parcial" ? `${model.fundLabel(v.fundId)}${v.receivedBy ? ` · ${v.receivedBy}` : ""}` : v.kind === "exento" ? "exento" : "pendiente"}</span>
                      </span>
                      <span className={`mono whitespace-nowrap ${v.kind === "estimado" || v.kind === "parcial" ? "text-warn" : "text-muted"}`}>
                        {money(Math.max(v.expected, v.received))}
                        {v.kind === "estimado" || v.kind === "parcial" ? " *" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
            {otherIncomes.map((e) => {
              const status = incomeStatusOf(e);
              return (
                <div key={e.id} className={`${ROW} border-b border-line-soft`} data-income={e.concept}>
                  <span className={`mono text-sm font-semibold ${AMOUNT}`}>
                    {money(e.amount)}
                    {status === "estimado" ? " *" : ""}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">{e.concept}</span>
                    <span className="text-xs text-muted">
                      {[e.notes, e.entryDate ? formatShortDate(e.entryDate) : null, status === "recibido" ? `→ ${model.fundLabel(e.fundId)}${e.registeredBy ? ` · por ${e.registeredBy}` : ""}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Pill tone="muted">{e.category === "donaciones_especie" ? "En especie" : e.source === "grupo" ? "Grupo" : "Externo"}</Pill>
                    {manage ? (
                      <form action={toggleIncomeStatusAction.bind(null, mission.id, e.id)}>
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button type="submit" className="cursor-pointer" title={status === "recibido" ? "Volver a estimado" : "Marcar como recibido"}>
                          <Pill tone={status === "recibido" ? "ok" : "warn"}>{status === "recibido" ? "Recibido" : "Estimado *"}</Pill>
                        </button>
                      </form>
                    ) : (
                      <Pill tone={status === "recibido" ? "ok" : "warn"}>{status === "recibido" ? "Recibido" : "Estimado *"}</Pill>
                    )}
                    {manage ? (
                      <form action={deleteEntryAction.bind(null, mission.id, e.id)}>
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button type="submit" className="px-1 text-xs text-faint hover:text-danger" title="Eliminar" aria-label={`Eliminar ${e.concept}`}>
                          ✕
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!showVols && otherIncomes.length === 0 ? <p className="px-4 py-6 text-center text-sm text-faint">Sin ingresos de este tipo todavía.</p> : null}
            <div className="flex flex-col gap-1 bg-paper-2 px-4 py-3.5 text-[13px] sm:px-[18px]">
              <div className="flex justify-between">
                <span className="text-muted">Recibido</span>
                <span className="mono">{money(t.incRec)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Estimado / prometido *</span>
                <span className="mono text-warn">{money(t.incEst)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-1 font-extrabold">
                <span>TOTAL INGRESOS *</span>
                <span className="mono">{money(t.incTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white" data-expenses>
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-4 py-4 sm:px-[18px]">
              <div className="flex flex-col">
                <span className="section-title">Gastos</span>
                <span className="text-xs text-muted">Fijos primero · clic en el estado para avanzarlo (pendiente → comprometido → pagado)</span>
              </div>
              {manage ? (
                <Link href={href({ nuevo: "gasto" })} className="btn-primary w-full sm:w-auto">
                  + Agregar gasto
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5 border-b border-line-soft px-4 py-2.5 sm:px-[18px]">
              <FilterChip href={href({ gastos: undefined })} on={expF === "todas"} label="Todas" />
              {usedCats.map((c) => (
                <FilterChip key={c.value} href={href({ gastos: c.value })} on={expF === c.value} label={c.label} />
              ))}
            </div>
            {expenseGroups.length === 0 ? <p className="px-4 py-6 text-center text-sm text-faint">Sin gastos registrados.</p> : null}
            {expenseGroups.map((g) => (
              <div key={g.value} className="border-b border-line" data-expense-group={g.value}>
                <div className="flex items-center justify-between gap-2 bg-paper-2 px-4 py-2.5 sm:px-[18px]">
                  <span className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.06em]">
                    <span>{g.label}</span>
                    <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal ${g.fixed ? "bg-brand-900 text-paper" : "bg-warn-soft text-warn"}`}>{g.fixed ? "FIJO" : "VARIABLE"}</span>
                  </span>
                  <span className="mono text-[13px] font-semibold">{money(g.subtotal)}</span>
                </div>
                {g.items.map((i) => (
                  <div key={i.id} className={`${ROW} border-t border-line-soft`} data-expense={i.concept}>
                    <span className={`mono text-sm ${AMOUNT}`}>{money(i.amount)}</span>
                    <div className="flex min-w-0 flex-col">
                      <span className="font-semibold">{i.concept}</span>
                      {i.sub ? <span className="text-xs text-muted">{i.sub}</span> : null}
                      {i.pay ? (
                        <span className={`text-xs ${i.payPending ? "text-warn" : "text-brand-800"}`}>
                          {i.pay}
                          {i.reimbursable && manage ? (
                            <>
                              {" · "}
                              <Link href={href({ reembolso: i.id })} className="font-semibold underline">
                                Marcar reembolsado
                              </Link>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {i.fromWish ? (
                        <Pill tone="ok">Comprado</Pill>
                      ) : manage ? (
                        <form action={cycleExpenseStatusAction.bind(null, mission.id, i.id)}>
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button type="submit" className="cursor-pointer" title="Avanzar de estado">
                            <Pill tone={i.status === "pagado" ? "ok" : i.status === "comprometido" ? "warn" : "muted"}>{labelOf(EXPENSE_LABELS, i.status)}</Pill>
                          </button>
                        </form>
                      ) : (
                        <Pill tone={i.status === "pagado" ? "ok" : i.status === "comprometido" ? "warn" : "muted"}>{labelOf(EXPENSE_LABELS, i.status)}</Pill>
                      )}
                      {manage ? (
                        <form action={(i.fromWish ? returnWishItemAction : deleteEntryAction).bind(null, mission.id, i.id)}>
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button type="submit" className="px-1 text-xs text-faint hover:text-danger" title={i.fromWish ? "Devolver a la lista" : "Eliminar"} aria-label={`${i.fromWish ? "Devolver a la lista" : "Eliminar"} ${i.concept}`}>
                            {i.fromWish ? "↺" : "✕"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex flex-col gap-1 bg-paper-2 px-4 py-3.5 text-[13px] sm:px-[18px]">
              <div className="flex justify-between font-extrabold">
                <span>TOTAL GASTOS FIJOS</span>
                <span className="mono">{money(t.fijos)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Fijos pagados hasta hoy</span>
                <span className="mono">{money(t.fijosPagados)}</span>
              </div>
              <div className="mt-0.5 flex justify-between border-t border-dashed border-line pt-1.5">
                <span className="text-muted">Total pagado (fijos + variables) · por origen</span>
                <span className="mono">{money(t.pagadoTotal)}</span>
              </div>
              {payBreakdown.map((p) => (
                <div key={p.label} className="flex justify-between gap-2 pl-3">
                  <span className="text-faint">{p.label}</span>
                  <span className={`mono whitespace-nowrap ${p.warn ? "text-warn" : ""}`}>{money(p.value)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-1 font-extrabold">
                <span>PRESUPUESTO DISPONIBLE</span>
                <Money amount={t.disponible} tone="auto" />
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Actividades y compras ya ejecutadas</span>
                <span className="mono">{money(t.variables)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Saldo para compras</span>
                <Money amount={t.budgetWish} tone="auto" />
              </div>
            </div>
          </div>
        </section>

        {/* Lista de compras */}
        <section className="overflow-hidden rounded-2xl border border-line bg-white" data-wish-list>
          <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-line px-4 py-4 sm:px-[18px]">
            <div className="flex flex-col">
              <span className="section-title">Lista de compras · materiales y donaciones</span>
              <span className="text-xs text-muted">Ordena por prioridad. Se compra en orden mientras haya saldo; lo que no alcanza es la meta de recaudo.</span>
            </div>
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 sm:w-auto">
              <div className="flex flex-col">
                <span className="kpi-label">Pendiente</span>
                <span className="mono text-base font-semibold">{money(t.wishPending)}</span>
              </div>
              <div className="flex flex-col">
                <span className="kpi-label text-brand-800">Cubierto con saldo</span>
                <span className="mono text-base font-semibold text-brand-800">{money(t.coveredSum)}</span>
              </div>
              <div className="flex flex-col rounded-[10px] bg-warn-soft px-3 py-1.5">
                <span className="kpi-label text-warn">Falta por recaudar</span>
                <span className="mono text-base font-semibold text-warn" data-meta>
                  {money(t.meta)}
                </span>
              </div>
              {manage ? (
                <Link href={href({ nuevo: "lista" })} className="btn-primary w-full sm:w-auto">
                  + Agregar a la lista
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-b border-line-soft px-4 py-3 sm:px-[18px]">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-sand">
              <div className="h-full bg-brand-600" style={{ width: `${coveredW}%` }} />
              <div className="h-full bg-accent-500" style={{ width: `${100 - coveredW}%` }} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip href={href({ lista: undefined })} on={wishF === "todas"} label="Todas" />
              {WISH_CATEGORIES.map((c) => (
                <FilterChip key={c.value} href={href({ lista: c.value })} on={wishF === c.value} label={c.label} dot={c.color} />
              ))}
              <span className="ml-auto text-xs text-muted">
                Saldo para compras: <Money amount={t.budgetWish} tone="auto" className="font-semibold" />
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[40px_64px_minmax(0,2fr)_130px_120px_130px_170px] border-b border-line bg-paper-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted sm:px-[18px]">
                <span>#</span>
                <span />
                <span>Ítem</span>
                <span>Categoría</span>
                <span className="text-right">Costo est.</span>
                <span className="pl-3">Estado</span>
                <span />
              </div>
              {wishRows.length === 0 ? <p className="px-4 py-6 text-center text-sm text-faint">Nada en la lista para esta categoría.</p> : null}
              {wishRows.map(({ w, n }) => {
                const done = w.status === "comprado";
                const cv = model.covered.has(w.id);
                const cat = wishCategoryInfo(w.category);
                return (
                  <div key={w.id} className={`grid grid-cols-[40px_64px_minmax(0,2fr)_130px_120px_130px_170px] items-center border-b border-line-soft px-4 py-2.5 text-sm sm:px-[18px] ${done ? "bg-paper-2" : cv ? "bg-white" : "bg-warn-soft/30"}`} data-wish={w.name}>
                    <span className="mono text-xs text-faint">{n}</span>
                    <div className="flex gap-0.5">
                      {manage && !done ? (
                        <>
                          <form action={moveWishItemAction.bind(null, mission.id, w.id)}>
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <input type="hidden" name="direction" value="up" />
                            <button type="submit" className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-white text-[10px] text-muted hover:bg-paper-2" title="Subir" aria-label={`Subir ${w.name}`}>
                              ▲
                            </button>
                          </form>
                          <form action={moveWishItemAction.bind(null, mission.id, w.id)}>
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <input type="hidden" name="direction" value="down" />
                            <button type="submit" className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-white text-[10px] text-muted hover:bg-paper-2" title="Bajar" aria-label={`Bajar ${w.name}`}>
                              ▼
                            </button>
                          </form>
                        </>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className={`font-semibold ${done ? "text-faint line-through" : ""}`}>{w.name}</span>
                      <span className="text-xs text-muted">{w.detail}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: cat.color }}>
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: cat.color }} />
                      {cat.label}
                    </span>
                    <span className="mono text-right">{money(w.total)}</span>
                    <span className="pl-3">
                      <Pill tone={done || cv ? "ok" : "warn"}>{done ? "Comprado" : cv ? "Cubierto con saldo" : "Falta saldo"}</Pill>
                    </span>
                    <div className="flex justify-end gap-1.5">
                      {done ? (
                        <span className="rounded-lg bg-line-soft px-2.5 py-1.5 text-xs font-bold text-muted">Comprado ✓</span>
                      ) : cv && manage ? (
                        <Link href={href({ comprar: w.id })} className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-700">
                          Comprar
                        </Link>
                      ) : (
                        <span className="rounded-lg bg-line-soft px-2.5 py-1.5 text-xs font-bold text-faint">{cv ? "Cubierto" : "Sin saldo"}</span>
                      )}
                      {manage ? (
                        <form action={(done ? returnWishItemAction : deleteWishItemAction).bind(null, mission.id, w.id)}>
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button type="submit" className="px-1 py-1.5 text-xs text-faint hover:text-danger" title={done ? "Devolver a la lista" : "Quitar de la lista"} aria-label={`${done ? "Devolver a la lista" : "Quitar"} ${w.name}`}>
                            {done ? "↺" : "✕"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1 bg-paper-2 px-4 py-3.5 text-[13px] sm:px-[18px]">
            <div className="flex justify-between">
              <span className="text-muted">Ya comprado (aparece en Gastos · Materiales)</span>
              <span className="mono">{money(t.bought)}</span>
            </div>
            <div className="flex justify-between font-extrabold">
              <span>COSTO TOTAL LISTA PENDIENTE</span>
              <span className="mono">{money(t.wishPending)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-1 font-extrabold">
              <span>SALDO TOTAL</span>
              <Money amount={t.saldoTotal} tone={t.saldoTotal < 0 ? "out" : "in"} />
            </div>
            <p className="pt-1 text-xs text-muted">{financeSummaryText(t, money)}</p>
          </div>
        </section>
      </PageBody>

      {manage && sp.nuevo === "ingreso" ? (
        <Modal kicker="Ingresos" title="Registrar ingreso" closeHref={closeHref}>
          <IncomeForm {...common} volunteers={volunteerOptions} groups={groups} perPerson={model.perPerson} />
        </Modal>
      ) : null}
      {manage && sp.nuevo === "gasto" ? (
        <Modal kicker="Gastos" title="Agregar gasto" closeHref={closeHref}>
          <ExpenseForm {...common} />
        </Modal>
      ) : null}
      {manage && sp.nuevo === "lista" ? (
        <Modal kicker="Lista de compras" title="Agregar ítem a la lista" closeHref={closeHref}>
          <WishForm missionId={mission.id} returnTo={returnTo} closeHref={closeHref} />
        </Modal>
      ) : null}
      {manage && buyItem ? (
        <Modal kicker="Lista de compras" title="Registrar compra" closeHref={closeHref}>
          <BuyForm {...common} item={{ id: buyItem.id, name: buyItem.name, total: buyItem.total }} />
        </Modal>
      ) : null}
      {manage && sp.traslado ? (
        <Modal kicker="Tesorería" title="Traslado entre cuentas" closeHref={closeHref}>
          <TransferForm {...common} />
        </Modal>
      ) : null}
      {manage && sp.cuentas ? (
        <Modal kicker="Tesorería" title="Cuentas de tesorería" closeHref={closeHref}>
          <FundsPanel missionId={mission.id} returnTo={href({ cuentas: "1" })} closeHref={closeHref} funds={fundOptions} people={people} />
        </Modal>
      ) : null}
      {manage && reimburseEntry ? (
        <Modal kicker="Gastos" title="Marcar reembolsado" closeHref={closeHref}>
          <ReimburseForm missionId={mission.id} returnTo={returnTo} closeHref={closeHref} funds={fundOptions} entry={{ id: reimburseEntry.id, concept: reimburseEntry.concept, amount: reimburseEntry.amount, payPerson: reimburseEntry.payPerson }} />
        </Modal>
      ) : null}
    </>
  );
}

const EXPENSE_LABELS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "comprometido", label: "Comprometido" },
  { value: "pagado", label: "Pagado" },
  { value: "comprado", label: "Comprado" },
] as const;

// El tipo del modelo se usa solo para la inferencia de los helpers de arriba.
export type { FinanceModel };
