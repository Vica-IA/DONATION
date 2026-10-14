"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Seg } from "@/components/seg";
import { Field } from "@/components/ui";
import { BUDGET_KINDS, EXPENSE_STATUS, FINANCE_CATEGORIES, FUND_TYPES, INCOME_SOURCES, INCOME_STATUS, PAY_KINDS, WISH_CATEGORIES, expenseSubtypes, isFixedExpenseCategory, type BudgetKind, type ExpenseStatus, type IncomeSource, type IncomeStatus, type PayKind } from "@/lib/catalogs";
import { formatCOP } from "@/lib/format";
import { buyWishItemAction, createExpenseAction, createFundAction, createIncomeAction, createTransferAction, createWishItemAction, markReimbursedAction, toggleFundAction, type ModalState } from "./actions";

export type FundOption = { id: string; label: string; ownerName: string; type: string; balance: number; active: boolean };
export type VolunteerOption = { id: string; label: string };

const EMPTY: ModalState = { errors: {}, values: {} };

function useFormBits(state: ModalState) {
  const str = (key: string, fallback = "") => (typeof state.values[key] === "string" ? (state.values[key] as string) : fallback);
  const cls = (key: string) => `input${state.errors[key] ? " input-error" : ""}`;
  return { str, cls };
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>;
}

function Footer({ closeHref, pending, label }: { closeHref: string; pending: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">
      <Link href={closeHref} className="btn-secondary">
        Cancelar
      </Link>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : label}
      </button>
    </div>
  );
}

function FormError({ state }: { state: ModalState }) {
  return state.errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.errors._form}</div> : null;
}

function FundSelect({ id, name, funds, defaultValue, className, label }: { id: string; name: string; funds: FundOption[]; defaultValue: string; className: string; label?: boolean }) {
  return (
    <select id={id} name={name} className={className} defaultValue={defaultValue}>
      {funds
        .filter((f) => f.active)
        .map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
            {label ? ` · saldo ${formatCOP(f.balance)}` : ""}
          </option>
        ))}
    </select>
  );
}

function PeopleSelect({ id, name, people, defaultValue, className }: { id: string; name: string; people: string[]; defaultValue: string; className: string }) {
  const list = people.includes(defaultValue) || !defaultValue ? people : [defaultValue, ...people];
  return (
    <select id={id} name={name} className={className} defaultValue={defaultValue}>
      {list.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}

type Common = { missionId: string; returnTo: string; closeHref: string; funds: FundOption[]; people: string[]; me: string };

// ---------- Ingreso ----------

export function IncomeForm({ missionId, returnTo, closeHref, funds, people, me, volunteers, groups, perPerson }: Common & { volunteers: VolunteerOption[]; groups: string[]; perPerson: number }) {
  const [state, formAction, pending] = useActionState<ModalState, FormData>(createIncomeAction.bind(null, missionId), EMPTY);
  const { str, cls } = useFormBits(state);
  const initialSource = (str("source", "voluntario") as IncomeSource) || "voluntario";
  const initialStatus = (str("status", "recibido") as IncomeStatus) || "recibido";
  const [source, setSource] = useState<IncomeSource>(initialSource);
  const [status, setStatus] = useState<IncomeStatus>(initialStatus);
  const firstFund = funds.find((f) => f.active)?.id ?? "";

  return (
    <form action={formAction} noValidate className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Body>
        <FormError state={state} />
        <div className="flex flex-col gap-2">
          <span className="label mb-0">Fuente</span>
          <Seg name="source" options={INCOME_SOURCES} initial={initialSource} onChange={setSource} />
          {state.errors.source ? <p className="error">{state.errors.source}</p> : null}
        </div>
        {source === "voluntario" ? (
          <Field label="Voluntario" htmlFor="registrationId" error={state.errors.registrationId} required help="Si ya tiene un aporte registrado, se actualiza.">
            <select id="registrationId" name="registrationId" className={cls("registrationId")} defaultValue={str("registrationId", volunteers[0]?.id ?? "")}>
              {volunteers.length === 0 ? <option value="">Todavía no hay personas confirmadas</option> : null}
              {volunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        ) : source === "grupo" ? (
          <Field label="Grupo" htmlFor="who" error={state.errors.who} required>
            <select id="who" name="who" className={cls("who")} defaultValue={str("who", groups[0] ?? "")}>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Donante" htmlFor="who" error={state.errors.who} required>
            <input id="who" name="who" className={cls("who")} defaultValue={str("who")} placeholder="Persona, parroquia o empresa" />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor (COP)" htmlFor="amount" error={state.errors.amount} required help="Sin decimales. Puedes escribir 320.000 o 320000.">
            <input id="amount" name="amount" inputMode="numeric" className={cls("amount")} defaultValue={str("amount", source === "voluntario" && perPerson ? String(perPerson) : "")} placeholder={perPerson ? String(perPerson) : "0"} />
          </Field>
          <Field label="Fecha" htmlFor="entryDate" error={state.errors.entryDate} help="Si queda vacía y está recibido, se usa hoy.">
            <input id="entryDate" name="entryDate" type="date" className={cls("entryDate")} defaultValue={str("entryDate")} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label mb-0">Estado</span>
          <Seg name="status" options={INCOME_STATUS} initial={initialStatus} onChange={setStatus} />
          <p className="help">Lo estimado o prometido suma al total con asterisco (*), pero no al recibido.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {status === "recibido" ? (
            <Field label="¿A qué cuenta llegó?" htmlFor="fundId" error={state.errors.fundId} required>
              <FundSelect id="fundId" name="fundId" funds={funds} defaultValue={str("fundId", firstFund)} className={cls("fundId")} />
            </Field>
          ) : null}
          <Field label="Registrado por" htmlFor="registeredBy" error={state.errors.registeredBy}>
            <PeopleSelect id="registeredBy" name="registeredBy" people={people} defaultValue={str("registeredBy", me)} className={cls("registeredBy")} />
          </Field>
        </div>
        <Field label="Nota" htmlFor="note" error={state.errors.note}>
          <input id="note" name="note" className={cls("note")} defaultValue={str("note")} placeholder="Ej. Transferencia Bancolombia · 8 oct" />
        </Field>
        {source !== "voluntario" ? (
          <label className="choice">
            <input type="checkbox" name="inKind" defaultChecked={str("inKind") === "on"} className="mt-0.5" />
            <span>
              Donación en especie
              <span className="block text-xs text-muted">Materiales, alimentos, transporte… con su valor estimado. No entra a ninguna cuenta.</span>
            </span>
          </label>
        ) : null}
      </Body>
      <Footer closeHref={closeHref} pending={pending} label="Registrar ingreso" />
    </form>
  );
}

// ---------- Gasto ----------

export function ExpenseForm({ missionId, returnTo, closeHref, funds, people, me }: Common) {
  const [state, formAction, pending] = useActionState<ModalState, FormData>(createExpenseAction.bind(null, missionId), EMPTY);
  const { str, cls } = useFormBits(state);
  const categories = FINANCE_CATEGORIES.filter((c) => c.kind === "gasto");
  const initialCategory = str("category", "transporte");
  const [category, setCategory] = useState(initialCategory);
  const initialKind = (str("budgetKind", isFixedExpenseCategory(initialCategory) ? "fijo" : "variable") as BudgetKind) || "variable";
  const [kindKey, setKindKey] = useState(0);
  const [status, setStatus] = useState<ExpenseStatus>((str("status", "pendiente") as ExpenseStatus) || "pendiente");
  const initialPay = (str("payKind", "fund") as PayKind) || "fund";
  const [payKind, setPayKind] = useState<PayKind>(initialPay);
  const subs = expenseSubtypes(category);
  const firstFund = funds.find((f) => f.active)?.id ?? "";
  const kindForCategory: BudgetKind = isFixedExpenseCategory(category) ? "fijo" : "variable";

  return (
    <form action={formAction} noValidate className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Body>
        <FormError state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría" htmlFor="category" error={state.errors.category} required>
            <select
              id="category"
              name="category"
              className={cls("category")}
              defaultValue={initialCategory}
              onChange={(e) => {
                setCategory(e.target.value);
                setKindKey((k) => k + 1);
              }}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {subs.length ? (
            <Field label="Tipo" htmlFor="sub" error={state.errors.sub}>
              <select key={category} id="sub" name="sub" className={cls("sub")} defaultValue={str("sub", subs[0])}>
                {subs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
        <Field label="Concepto" htmlFor="concept" error={state.errors.concept} required>
          <input id="concept" name="concept" className={cls("concept")} defaultValue={str("concept")} placeholder="Ej. Gasolina lanchas día 2" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor (COP)" htmlFor="amount" error={state.errors.amount} required help="Sin decimales. Puedes escribir 1.500.000 o 1500000.">
            <input id="amount" name="amount" inputMode="numeric" className={cls("amount")} defaultValue={str("amount")} placeholder="0" />
          </Field>
          <Field label="Proveedor" htmlFor="vendor" error={state.errors.vendor}>
            <input id="vendor" name="vendor" className={cls("vendor")} defaultValue={str("vendor")} placeholder="Opcional" />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label mb-0">Tipo de gasto</span>
          <Seg key={kindKey} name="budgetKind" options={BUDGET_KINDS} initial={kindKey === 0 ? initialKind : kindForCategory} />
          <p className="help">Fijo: debe quedar cubierto por los ingresos antes de comprar materiales. Variable: sale del saldo para compras.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estado" htmlFor="status" error={state.errors.status} required>
            <select id="status" name="status" className={cls("status")} defaultValue={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)}>
              {EXPENSE_STATUS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "comprometido" ? "Comprometido (acordado, sin pagar)" : o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Registrado / realizado por" htmlFor="registeredBy" error={state.errors.registeredBy}>
            <PeopleSelect id="registeredBy" name="registeredBy" people={people} defaultValue={str("registeredBy", me)} className={cls("registeredBy")} />
          </Field>
        </div>
        {status === "pagado" ? (
          <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-paper-2 p-3.5">
            <span className="label mb-0">¿Desde dónde se pagó?</span>
            <Seg name="payKind" options={PAY_KINDS} initial={initialPay} onChange={setPayKind} />
            {payKind === "fund" ? (
              <Field label="Cuenta" htmlFor="fundId" error={state.errors.fundId} required>
                <FundSelect id="fundId" name="fundId" funds={funds} defaultValue={str("fundId", firstFund)} className={cls("fundId")} label />
              </Field>
            ) : (
              <Field label="Quién lo adelantó" htmlFor="payPerson" error={state.errors.payPerson} required help="Queda registrado como reembolso pendiente a esa persona.">
                <input id="payPerson" name="payPerson" list="personas-finanzas" className={cls("payPerson")} defaultValue={str("payPerson")} placeholder="Nombre" />
              </Field>
            )}
            <Field label="Comprobante o referencia" htmlFor="payRef" error={state.errors.payRef}>
              <input id="payRef" name="payRef" className={cls("payRef")} defaultValue={str("payRef")} placeholder="Opcional" />
            </Field>
            <Field label="Fecha del pago" htmlFor="entryDate" error={state.errors.entryDate} help="Si queda vacía, se usa hoy.">
              <input id="entryDate" name="entryDate" type="date" className={cls("entryDate")} defaultValue={str("entryDate")} />
            </Field>
          </div>
        ) : (
          <Field label="Fecha prevista" htmlFor="entryDate" error={state.errors.entryDate}>
            <input id="entryDate" name="entryDate" type="date" className={cls("entryDate")} defaultValue={str("entryDate")} />
          </Field>
        )}
        <datalist id="personas-finanzas">
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Body>
      <Footer closeHref={closeHref} pending={pending} label="Agregar gasto" />
    </form>
  );
}

// ---------- Lista de compras ----------

export function WishForm({ missionId, returnTo, closeHref }: { missionId: string; returnTo: string; closeHref: string }) {
  const [state, formAction, pending] = useActionState<ModalState, FormData>(createWishItemAction.bind(null, missionId), EMPTY);
  const { str, cls } = useFormBits(state);
  const toNumber = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;
  const [qty, setQty] = useState(toNumber(str("qty", "1")) || 1);
  const [unit, setUnit] = useState(toNumber(str("unitCost", "")));

  return (
    <form action={formAction} noValidate className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Body>
        <FormError state={state} />
        <Field label="Ítem" htmlFor="name" error={state.errors.name} required>
          <input id="name" name="name" className={cls("name")} defaultValue={str("name")} placeholder="Ej. Tanque de agua 2.000 L" />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="label mb-0">Categoría</span>
          <Seg name="category" options={WISH_CATEGORIES} initial={str("category", "construccion")} cols={2} />
          {state.errors.category ? <p className="error">{state.errors.category}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cantidad" htmlFor="qty" error={state.errors.qty} required>
            <input id="qty" name="qty" inputMode="numeric" className={cls("qty")} defaultValue={str("qty", "1")} onChange={(e) => setQty(toNumber(e.target.value))} />
          </Field>
          <Field label="Costo unitario (COP)" htmlFor="unitCost" error={state.errors.unitCost} required>
            <input id="unitCost" name="unitCost" inputMode="numeric" className={cls("unitCost")} defaultValue={str("unitCost")} placeholder="0" onChange={(e) => setUnit(toNumber(e.target.value))} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line bg-paper-2 px-3.5 py-3">
          <span className="text-[13px] text-muted">Costo estimado</span>
          <span className="mono text-base font-semibold" data-wish-total>
            {formatCOP(qty * unit)}
          </span>
        </div>
        <Field label="Nota" htmlFor="note" error={state.errors.note}>
          <input id="note" name="note" className={cls("note")} defaultValue={str("note")} placeholder="Para qué se usa, proveedor sugerido…" />
        </Field>
        <p className="help">Se agrega al final de la lista; sube o baja su prioridad con las flechas.</p>
      </Body>
      <Footer closeHref={closeHref} pending={pending} label="Agregar a la lista" />
    </form>
  );
}

export function BuyForm({ missionId, returnTo, closeHref, funds, people, me, item }: Common & { item: { id: string; name: string; total: number } }) {
  const [state, formAction, pending] = useActionState<ModalState, FormData>(buyWishItemAction.bind(null, missionId, item.id), EMPTY);
  const { str, cls } = useFormBits(state);
  const active = funds.filter((f) => f.active);
  const [fundId, setFundId] = useState(str("fundId", active[0]?.id ?? ""));
  const fund = funds.find((f) => f.id === fundId);
  const short = fund ? fund.balance < item.total : false;

  return (
    <form action={formAction} noValidate className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Body>
        <FormError state={state} />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-2 px-3.5 py-3">
          <span className="font-semibold">{item.name}</span>
          <span className="mono whitespace-nowrap text-base font-semibold">{formatCOP(item.total)}</span>
        </div>
        <Field label="¿Con qué se paga?" htmlFor="fundId" error={state.errors.fundId} required help={fund ? `Saldo actual de esa cuenta: ${formatCOP(fund.balance)}` : undefined}>
          <select id="fundId" name="fundId" className={cls("fundId")} defaultValue={fundId} onChange={(e) => setFundId(e.target.value)}>
            {active.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        {short ? <p className="rounded-[10px] bg-warn-soft px-3 py-2.5 text-[13px] font-semibold text-warn">Esa cuenta no alcanza para esta compra. Haz un traslado o elige otra cuenta.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quién compra" htmlFor="boughtBy" error={state.errors.boughtBy}>
            <PeopleSelect id="boughtBy" name="boughtBy" people={people} defaultValue={str("boughtBy", me)} className={cls("boughtBy")} />
          </Field>
          <Field label="Factura o referencia" htmlFor="reference" error={state.errors.reference}>
            <input id="reference" name="reference" className={cls("reference")} defaultValue={str("reference")} placeholder="Opcional" />
          </Field>
        </div>
        <Field label="Fecha" htmlFor="entryDate" error={state.errors.entryDate} help="Si queda vacía, se usa hoy.">
          <input id="entryDate" name="entryDate" type="date" className={cls("entryDate")} defaultValue={str("entryDate")} />
        </Field>
      </Body>
      <Footer closeHref={closeHref} pending={pending} label="Confirmar compra" />
    </form>
  );
}

// ---------- Tesorería ----------

export function TransferForm({ missionId, returnTo, closeHref, funds, people, me }: Common) {
  const [state, formAction, pending] = useActionState<ModalState, FormData>(createTransferAction.bind(null, missionId), EMPTY);
  const { str, cls } = useFormBits(state);
  const active = funds.filter((f) => f.active);
  const [from, setFrom] = useState(str("fromFundId", active[0]?.id ?? ""));
  const fromFund = funds.find((f) => f.id === from);

  return (
    <form action={formAction} noValidate className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Body>
        <FormError state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desde" htmlFor="fromFundId" error={state.errors.fromFundId} required help={fromFund ? `Saldo: ${formatCOP(fromFund.balance)}` : undefined}>
            <select id="fromFundId" name="fromFundId" className={cls("fromFundId")} defaultValue={from} onChange={(e) => setFrom(e.target.value)}>
              {active.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hacia" htmlFor="toFundId" error={state.errors.toFundId} required>
            <select id="toFundId" name="toFundId" className={cls("toFundId")} defaultValue={str("toFundId", active[1]?.id ?? active[0]?.id ?? "")}>
              {active.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor (COP)" htmlFor="amount" error={state.errors.amount} required>
            <input id="amount" name="amount" inputMode="numeric" className={cls("amount")} defaultValue={str("amount")} placeholder="0" />
          </Field>
          <Field label="Realizado por" htmlFor="performedBy" error={state.errors.performedBy}>
            <PeopleSelect id="performedBy" name="performedBy" people={people} defaultValue={str("performedBy", me)} className={cls("performedBy")} />
          </Field>
        </div>
        <Field label="Motivo" htmlFor="note" error={state.errors.note}>
          <input id="note" name="note" className={cls("note")} defaultValue={str("note")} placeholder="Ej. Retiro de efectivo para compras en la comunidad" />
        </Field>
        <Field label="Fecha" htmlFor="entryDate" error={state.errors.entryDate} help="Si queda vacía, se usa hoy.">
          <input id="entryDate" name="entryDate" type="date" className={cls("entryDate")} defaultValue={str("entryDate")} />
        </Field>
        <p className="help">Un traslado no cambia el total disponible; solo mueve saldo entre cuentas (por ejemplo, retirar efectivo del banco).</p>
      </Body>
      <Footer closeHref={closeHref} pending={pending} label="Registrar traslado" />
    </form>
  );
}

export function FundsPanel({ missionId, returnTo, closeHref, funds, people }: Omit<Common, "me">) {
  const [state, formAction, pending] = useActionState<ModalState, FormData>(createFundAction.bind(null, missionId), EMPTY);
  const { str, cls } = useFormBits(state);
  const owners = [...new Set([...funds.map((f) => f.ownerName), ...people])];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-6">
        {funds.length === 0 ? <p className="py-4 text-sm text-muted">Todavía no hay cuentas. Crea una por cada responsable: banco y efectivo.</p> : null}
        {funds.map((f) => (
          <div key={f.id} className={`flex items-center gap-3 border-b border-line-soft py-2.5 ${f.active ? "" : "opacity-60"}`} data-fund={f.label}>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{f.label}</span>
              <span className="text-xs text-muted">
                {f.ownerName} · {f.type === "banco" ? "Banco" : "Efectivo"} · saldo {formatCOP(f.balance)}
                {f.active ? "" : " · inactiva"}
              </span>
            </div>
            <form action={toggleFundAction.bind(null, missionId, f.id)}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="active" value={f.active ? "0" : "1"} />
              <button type="submit" className={`rounded-lg px-2 py-1 text-[13px] font-semibold ${f.active ? "text-danger hover:bg-danger-soft" : "text-brand-700 hover:bg-brand-50"}`}>
                {f.active ? "Desactivar" : "Activar"}
              </button>
            </form>
          </div>
        ))}
      </div>
      <form action={formAction} noValidate className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:px-6">
        <input type="hidden" name="returnTo" value={returnTo} />
        <FormError state={state} />
        <span className="label mb-0">Nueva cuenta</span>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
          <Field label="Responsable" htmlFor="ownerName" error={state.errors.ownerName} required>
            <input id="ownerName" name="ownerName" list="responsables-cuentas" className={cls("ownerName")} defaultValue={str("ownerName")} placeholder="Ej. Miguel" />
          </Field>
          <Field label="Tipo" htmlFor="type" error={state.errors.type} required>
            <select id="type" name="type" className={cls("type")} defaultValue={str("type", "banco")}>
              {FUND_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Nombre de la cuenta" htmlFor="label" error={state.errors.label} required>
          <input id="label" name="label" className={cls("label")} defaultValue={str("label")} placeholder="Ej. Cuenta Miguel · Bancolombia" />
        </Field>
        <datalist id="responsables-cuentas">
          {owners.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <div className="flex justify-end gap-2">
          <Link href={closeHref} className="btn-secondary">
            Listo
          </Link>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Guardando…" : "Agregar cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ReimburseForm({ missionId, returnTo, closeHref, funds, entry }: { missionId: string; returnTo: string; closeHref: string; funds: FundOption[]; entry: { id: string; concept: string; amount: number; payPerson: string | null } }) {
  const [state, formAction, pending] = useActionState<ModalState, FormData>(markReimbursedAction.bind(null, missionId, entry.id), EMPTY);
  const { str, cls } = useFormBits(state);
  const firstFund = funds.find((f) => f.active)?.id ?? "";

  return (
    <form action={formAction} noValidate className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Body>
        <FormError state={state} />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-2 px-3.5 py-3">
          <span className="flex flex-col">
            <span className="font-semibold">{entry.concept}</span>
            <span className="text-xs text-muted">Lo adelantó {entry.payPerson ?? "—"}</span>
          </span>
          <span className="mono whitespace-nowrap text-base font-semibold">{formatCOP(entry.amount)}</span>
        </div>
        <Field label="¿Desde qué cuenta se le reembolsó?" htmlFor="fundId" error={state.errors.fundId} required>
          <FundSelect id="fundId" name="fundId" funds={funds} defaultValue={str("fundId", firstFund)} className={cls("fundId")} label />
        </Field>
        <Field label="Fecha" htmlFor="entryDate" error={state.errors.entryDate} help="Si queda vacía, se usa hoy.">
          <input id="entryDate" name="entryDate" type="date" className={cls("entryDate")} defaultValue={str("entryDate")} />
        </Field>
      </Body>
      <Footer closeHref={closeHref} pending={pending} label="Marcar reembolsado" />
    </form>
  );
}
