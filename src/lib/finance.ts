import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { EXPENSE_STATUS, INCOME_STATUS, WISH_CATEGORIES, isFixedExpenseCategory, labelOf, type BudgetKind, type ExpenseStatus, type IncomeStatus } from "./catalogs";
import { log } from "./data";
import { getDb } from "./db";
import {
  financeEntries,
  financeFunds,
  financeTransfers,
  missionRegistrations,
  organizations,
  volunteers,
  wishItems,
  type FinanceEntry,
  type FinanceFund,
  type FinanceTransfer,
  type Mission,
  type WishItem,
} from "./db/schema";
import { nowIso } from "./format";
import { todayBogota } from "./mission-timeline";
import type { BuyInput, ExpenseInput, FundInput, IncomeInput, ReimburseInput, TransferInput, WishItemInput } from "./validation";

/**
 * Finanzas de la misión, como las lleva Financiero: los ingresos cubren primero
 * los gastos fijos; lo que sobra compra la lista de materiales en orden de
 * prioridad; lo que falta es la meta de recaudo. La tesorería solo cuenta lo
 * recibido y lo pagado, por cuenta, y cada movimiento guarda quién lo hizo.
 */

export type FinanceRow = FinanceEntry;

// ---------- Lecturas ----------

export async function listEntries(missionId: string): Promise<FinanceRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(financeEntries)
    .where(eq(financeEntries.missionId, missionId))
    .orderBy(sql`${financeEntries.entryDate} is null`, desc(financeEntries.entryDate), desc(financeEntries.createdAt), asc(financeEntries.concept));
}

export async function getEntry(id: string): Promise<FinanceRow | null> {
  const db = await getDb();
  return (await db.select().from(financeEntries).where(eq(financeEntries.id, id)).limit(1))[0] ?? null;
}

export async function listFunds(missionId: string): Promise<FinanceFund[]> {
  const db = await getDb();
  return db.select().from(financeFunds).where(eq(financeFunds.missionId, missionId)).orderBy(asc(financeFunds.position), asc(financeFunds.createdAt));
}

export async function getFund(id: string): Promise<FinanceFund | null> {
  const db = await getDb();
  return (await db.select().from(financeFunds).where(eq(financeFunds.id, id)).limit(1))[0] ?? null;
}

export async function listTransfers(missionId: string): Promise<FinanceTransfer[]> {
  const db = await getDb();
  return db
    .select()
    .from(financeTransfers)
    .where(eq(financeTransfers.missionId, missionId))
    .orderBy(sql`${financeTransfers.entryDate} is null`, desc(financeTransfers.entryDate), desc(financeTransfers.createdAt));
}

export async function listWishItems(missionId: string): Promise<WishItem[]> {
  const db = await getDb();
  return db.select().from(wishItems).where(eq(wishItems.missionId, missionId)).orderBy(asc(wishItems.position), asc(wishItems.createdAt));
}

export async function getWishItem(id: string): Promise<WishItem | null> {
  const db = await getDb();
  return (await db.select().from(wishItems).where(eq(wishItems.id, id)).limit(1))[0] ?? null;
}

// ---------- Estados en pantalla ----------

export function expenseStatusOf(e: Pick<FinanceEntry, "status">): ExpenseStatus {
  return e.status === "ejecutado" ? "pagado" : e.status === "comprometido" ? "comprometido" : "pendiente";
}

export function incomeStatusOf(e: Pick<FinanceEntry, "status">): IncomeStatus {
  return e.status === "ejecutado" ? "recibido" : "estimado";
}

export function budgetKindOf(e: Pick<FinanceEntry, "budgetKind" | "category">): BudgetKind {
  if (e.budgetKind === "fijo" || e.budgetKind === "variable") return e.budgetKind;
  return isFixedExpenseCategory(e.category) ? "fijo" : "variable";
}

function storedExpenseStatus(s: ExpenseStatus) {
  return EXPENSE_STATUS.find((x) => x.value === s)?.stored ?? "proyectado";
}

function storedIncomeStatus(s: IncomeStatus) {
  return INCOME_STATUS.find((x) => x.value === s)?.stored ?? "proyectado";
}

// ---------- Aportes de voluntarios (viven en la ficha) ----------

export type VolunteerContribution = {
  registrationId: string;
  name: string;
  organizationName: string | null;
  /** recibido (pagado), parcial, estimado (pendiente) o exento. */
  kind: "recibido" | "parcial" | "estimado" | "exento";
  expected: number;
  received: number;
  fundId: string | null;
  receivedBy: string | null;
  date: string | null;
  notes: string | null;
};

export async function listVolunteerContributions(mission: Mission): Promise<VolunteerContribution[]> {
  const db = await getDb();
  const per = mission.contributionAmount ?? 0;
  const rows = await db
    .select({
      registrationId: missionRegistrations.id,
      name: volunteers.fullName,
      organizationName: organizations.name,
      paymentStatus: missionRegistrations.paymentStatus,
      paymentAmount: missionRegistrations.paymentAmount,
      fundId: missionRegistrations.paymentFundId,
      receivedBy: missionRegistrations.paymentReceivedBy,
      date: missionRegistrations.paymentDate,
      notes: missionRegistrations.paymentNotes,
    })
    .from(missionRegistrations)
    .innerJoin(volunteers, eq(volunteers.id, missionRegistrations.volunteerId))
    .leftJoin(organizations, eq(organizations.id, volunteers.organizationId))
    .where(and(eq(missionRegistrations.missionId, mission.id), eq(missionRegistrations.status, "confirmado")))
    .orderBy(asc(volunteers.fullName));
  return rows.map((r) => {
    const kind: VolunteerContribution["kind"] = r.paymentStatus === "pagado" ? "recibido" : r.paymentStatus === "parcial" ? "parcial" : r.paymentStatus === "exento" ? "exento" : "estimado";
    const received = kind === "recibido" ? (r.paymentAmount ?? per) : kind === "parcial" ? (r.paymentAmount ?? 0) : 0;
    const expected = kind === "exento" ? 0 : kind === "recibido" ? received : per;
    return { registrationId: r.registrationId, name: r.name, organizationName: r.organizationName ?? null, kind, expected, received, fundId: r.fundId ?? null, receivedBy: r.receivedBy ?? null, date: r.date ?? null, notes: r.notes ?? null };
  });
}

// ---------- Modelo ----------

export type FundBalance = FinanceFund & { received: number; spent: number; balance: number };

export type Move = {
  date: string | null;
  type: "Ingreso" | "Gasto" | "Compra" | "Traslado";
  concept: string;
  fund: string;
  by: string | null;
  amount: number;
};

export type FinanceTotals = {
  /** Ingresos recibidos (aportes recibidos + ingresos recibidos). */
  incRec: number;
  /** Estimado o prometido (lo que falta de aportes + ingresos estimados). */
  incEst: number;
  incTotal: number;
  fijos: number;
  fijosPagados: number;
  /** Gastos variables (cualquier estado) + compras hechas de la lista. */
  variables: number;
  bought: number;
  /** Ingresos − fijos. */
  disponible: number;
  /** Disponible − variables: lo que queda para la lista de compras. */
  budgetWish: number;
  wishPending: number;
  coveredSum: number;
  coveredCount: number;
  pendingCount: number;
  /** Saldo para compras − lista pendiente (negativo = meta de recaudo). */
  saldoTotal: number;
  meta: number;
  pagadoTotal: number;
  reimbPending: number;
  bank: number;
  cash: number;
};

export type FinanceModel = {
  perPerson: number;
  funds: FundBalance[];
  fundLabel: (id: string | null | undefined) => string;
  volunteers: VolunteerContribution[];
  incomes: FinanceRow[];
  expenses: FinanceRow[];
  wish: WishItem[];
  transfers: FinanceTransfer[];
  /** Ítems pendientes de la lista que se cubren con el saldo actual, en orden. */
  covered: Set<string>;
  totals: FinanceTotals;
  moves: Move[];
};

const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((acc, x) => acc + f(x), 0);

export async function financeModel(mission: Mission): Promise<FinanceModel> {
  const [entries, fundsRaw, wish, transfers, vols] = await Promise.all([listEntries(mission.id), listFunds(mission.id), listWishItems(mission.id), listTransfers(mission.id), listVolunteerContributions(mission)]);
  const fundById = new Map(fundsRaw.map((f) => [f.id, f] as const));
  const fundLabel = (id: string | null | undefined) => (id ? (fundById.get(id)?.label ?? "Cuenta eliminada") : "—");
  const incomes = entries.filter((e) => e.kind === "ingreso");
  const expenses = entries.filter((e) => e.kind === "gasto");

  const incRec = sum(vols, (v) => v.received) + sum(incomes.filter((e) => e.status === "ejecutado"), (e) => e.amount);
  const incEst = sum(vols, (v) => Math.max(0, v.expected - v.received)) + sum(incomes.filter((e) => e.status !== "ejecutado"), (e) => e.amount);
  const incTotal = incRec + incEst;
  const fixed = expenses.filter((e) => budgetKindOf(e) === "fijo");
  const fijos = sum(fixed, (e) => e.amount);
  const fijosPagados = sum(fixed.filter((e) => e.status === "ejecutado"), (e) => e.amount);
  const bought = sum(wish.filter((w) => w.status === "comprado"), (w) => w.total);
  const variables = sum(expenses.filter((e) => budgetKindOf(e) === "variable"), (e) => e.amount) + bought;
  const disponible = incTotal - fijos;
  const budgetWish = disponible - variables;
  const pending = wish.filter((w) => w.status !== "comprado");
  const wishPending = sum(pending, (w) => w.total);
  const covered = new Set<string>();
  let cum = 0;
  let blocked = false;
  for (const w of pending) {
    cum += w.total;
    if (!blocked && cum <= budgetWish) covered.add(w.id);
    else blocked = true;
  }
  const coveredItems = pending.filter((w) => covered.has(w.id));
  const saldoTotal = budgetWish - wishPending;
  const meta = Math.max(0, -saldoTotal);
  const pagadoTotal = sum(expenses.filter((e) => e.status === "ejecutado"), (e) => e.amount) + bought;
  const reimbPending = sum(expenses.filter((e) => e.status === "ejecutado" && e.payKind === "person" && !e.reimbursedFundId), (e) => e.amount);

  const funds: FundBalance[] = fundsRaw.map((f) => {
    const received =
      sum(vols.filter((v) => v.fundId === f.id), (v) => v.received) +
      sum(incomes.filter((e) => e.status === "ejecutado" && e.fundId === f.id), (e) => e.amount) +
      sum(transfers.filter((t) => t.toFundId === f.id), (t) => t.amount);
    const spent =
      sum(expenses.filter((e) => e.status === "ejecutado" && e.payKind === "fund" && e.fundId === f.id), (e) => e.amount) +
      sum(expenses.filter((e) => e.status === "ejecutado" && e.payKind === "person" && e.reimbursedFundId === f.id), (e) => e.amount) +
      sum(wish.filter((w) => w.status === "comprado" && w.fundId === f.id), (w) => w.total) +
      sum(transfers.filter((t) => t.fromFundId === f.id), (t) => t.amount);
    return { ...f, received, spent, balance: received - spent };
  });
  const bank = sum(funds.filter((f) => f.type === "banco"), (f) => f.balance);
  const cash = sum(funds.filter((f) => f.type === "efectivo"), (f) => f.balance);

  const moves: Move[] = [
    ...vols.filter((v) => v.received > 0).map((v): Move => ({ date: v.date, type: "Ingreso", concept: `Aporte · ${v.name}`, fund: fundLabel(v.fundId), by: v.receivedBy, amount: v.received })),
    ...incomes.filter((e) => e.status === "ejecutado").map((e): Move => ({ date: e.entryDate, type: "Ingreso", concept: e.concept, fund: fundLabel(e.fundId), by: e.registeredBy, amount: e.amount })),
    ...expenses
      .filter((e) => e.status === "ejecutado")
      .map((e): Move => ({ date: e.entryDate, type: "Gasto", concept: e.concept, fund: e.payKind === "person" ? `Adelantó ${e.payPerson ?? "—"}` : fundLabel(e.fundId), by: e.registeredBy, amount: e.amount })),
    ...wish.filter((w) => w.status === "comprado").map((w): Move => ({ date: w.boughtAt, type: "Compra", concept: w.name, fund: fundLabel(w.fundId), by: w.boughtBy, amount: w.total })),
    ...transfers.map((t): Move => ({ date: t.entryDate, type: "Traslado", concept: t.note || "Traslado entre cuentas", fund: `${fundLabel(t.fromFundId)} → ${fundLabel(t.toFundId)}`, by: t.performedBy, amount: t.amount })),
  ]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 10);

  return {
    perPerson: mission.contributionAmount ?? 0,
    funds,
    fundLabel,
    volunteers: vols,
    incomes,
    expenses,
    wish,
    transfers,
    covered,
    totals: { incRec, incEst, incTotal, fijos, fijosPagados, variables, bought, disponible, budgetWish, wishPending, coveredSum: sum(coveredItems, (w) => w.total), coveredCount: coveredItems.length, pendingCount: pending.length, saldoTotal, meta, pagadoTotal, reimbPending, bank, cash },
    moves,
  };
}

/** Frase corta para el resumen: qué falta o cuánto sobra. */
export function financeSummaryText(t: FinanceTotals, money: (n: number) => string): string {
  if (t.meta > 0) return `Faltan ${money(t.meta)} para completar la lista de compras. ${t.coveredCount} de ${t.pendingCount} ítems se pueden comprar con el saldo actual.`;
  return `La lista de compras está cubierta. Sobran ${money(t.saldoTotal)}.`;
}

/** Texto de cómo se pagó un gasto (vacío si no está pagado). */
export function payText(e: FinanceRow, fundLabel: (id: string | null | undefined) => string): string {
  if (e.status !== "ejecutado") return "";
  const base =
    e.payKind === "person"
      ? `Adelantó ${e.payPerson ?? "—"} · ${e.reimbursedFundId ? `reembolsado desde ${fundLabel(e.reimbursedFundId)}` : "reembolso pendiente"}`
      : `Pagado desde ${fundLabel(e.fundId)}`;
  return `${base}${e.registeredBy ? ` · por ${e.registeredBy}` : ""}${e.reference ? ` · ${e.reference}` : ""}`;
}

export function wishCategoryInfo(value: string) {
  return WISH_CATEGORIES.find((c) => c.value === value) ?? { value, label: labelOf(WISH_CATEGORIES, value) || value, color: "#8a958f" };
}

// ---------- Ingresos ----------

export async function createIncome(mission: Mission, input: IncomeInput, actor: string): Promise<string> {
  const db = await getDb();
  const now = nowIso();
  const recibido = input.status === "recibido";
  if (input.source === "voluntario") {
    const reg = (await db.select().from(missionRegistrations).where(and(eq(missionRegistrations.id, input.registrationId), eq(missionRegistrations.missionId, mission.id))).limit(1))[0];
    if (!reg) throw new Error("La inscripción no existe");
    const who = (await db.select({ name: volunteers.fullName }).from(volunteers).where(eq(volunteers.id, reg.volunteerId)).limit(1))[0]?.name ?? "voluntario";
    await db
      .update(missionRegistrations)
      .set({
        paymentStatus: recibido ? "pagado" : "pendiente",
        paymentAmount: input.amount,
        paymentFundId: recibido ? input.fundId || null : null,
        paymentReceivedBy: recibido ? input.registeredBy || null : null,
        paymentDate: recibido ? (input.entryDate ?? todayBogota()) : null,
        paymentNotes: input.note ?? reg.paymentNotes,
        updatedAt: now,
      })
      .where(eq(missionRegistrations.id, reg.id));
    await log("registration", reg.id, "aporte_registrado", `${who}: ${recibido ? "recibido" : "estimado"} · ${input.amount}${recibido ? ` · por ${input.registeredBy || actor}` : ""}`, actor);
    return who;
  }
  const id = crypto.randomUUID();
  const who = input.who.trim();
  await db.insert(financeEntries).values({
    id,
    missionId: mission.id,
    kind: "ingreso",
    status: storedIncomeStatus(input.status),
    category: input.inKind ? "donaciones_especie" : "donaciones",
    concept: who,
    amount: input.amount,
    entryDate: input.entryDate ?? (recibido ? todayBogota() : null),
    counterparty: who,
    notes: input.note,
    source: input.source,
    fundId: recibido ? input.fundId || null : null,
    registeredBy: input.registeredBy || null,
    createdBy: actor,
  });
  await log("finance", id, "registrado", `Ingreso ${input.status} · ${who} · ${input.amount}`, actor);
  return who;
}

/** Recibido ↔ estimado. Al pasar a recibido sin cuenta, usa la cuenta indicada. */
export async function toggleIncomeStatus(id: string, fallbackFundId: string | null, actor: string): Promise<void> {
  const db = await getDb();
  const e = await getEntry(id);
  if (!e || e.kind !== "ingreso") return;
  const toReceived = e.status !== "ejecutado";
  await db
    .update(financeEntries)
    .set({
      status: toReceived ? "ejecutado" : "proyectado",
      fundId: toReceived ? (e.fundId ?? fallbackFundId) : e.fundId,
      entryDate: toReceived ? (e.entryDate ?? todayBogota()) : e.entryDate,
      updatedAt: nowIso(),
    })
    .where(eq(financeEntries.id, id));
  await log("finance", id, "actualizado", `${e.concept}: ${toReceived ? "estimado → recibido" : "recibido → estimado"}`, actor);
}

// ---------- Gastos ----------

export async function createExpense(missionId: string, input: ExpenseInput, actor: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const paid = input.status === "pagado";
  await db.insert(financeEntries).values({
    id,
    missionId,
    kind: "gasto",
    status: storedExpenseStatus(input.status),
    category: input.category,
    sub: input.sub,
    concept: input.concept,
    amount: input.amount,
    counterparty: input.vendor,
    entryDate: input.entryDate ?? (paid ? todayBogota() : null),
    budgetKind: input.budgetKind,
    registeredBy: input.registeredBy || null,
    payKind: paid ? input.payKind : null,
    fundId: paid && input.payKind === "fund" ? input.fundId || null : null,
    payPerson: paid && input.payKind === "person" ? input.payPerson : null,
    reference: input.payRef,
    createdBy: actor,
  });
  await log("finance", id, "registrado", `Gasto ${input.status} · ${input.concept} · ${input.amount}`, actor);
  return id;
}

/** Pendiente → comprometido → pagado → pendiente. Al pasar a pagado sin origen, se paga desde la cuenta indicada. */
export async function cycleExpenseStatus(id: string, fallbackFundId: string | null, actor: string): Promise<ExpenseStatus | null> {
  const db = await getDb();
  const e = await getEntry(id);
  if (!e || e.kind !== "gasto") return null;
  const current = expenseStatusOf(e);
  const next: ExpenseStatus = current === "pendiente" ? "comprometido" : current === "comprometido" ? "pagado" : "pendiente";
  const paid = next === "pagado";
  await db
    .update(financeEntries)
    .set({
      status: storedExpenseStatus(next),
      payKind: paid ? (e.payKind ?? "fund") : e.payKind,
      fundId: paid && (e.payKind ?? "fund") === "fund" ? (e.fundId ?? fallbackFundId) : e.fundId,
      entryDate: paid ? (e.entryDate ?? todayBogota()) : e.entryDate,
      updatedAt: nowIso(),
    })
    .where(eq(financeEntries.id, id));
  await log("finance", id, "actualizado", `${e.concept}: ${current} → ${next}`, actor);
  return next;
}

export async function markReimbursed(id: string, input: ReimburseInput, actor: string): Promise<void> {
  const db = await getDb();
  const e = await getEntry(id);
  if (!e || e.kind !== "gasto" || e.payKind !== "person") throw new Error("Este gasto no lo adelantó una persona");
  await db
    .update(financeEntries)
    .set({ reimbursedFundId: input.fundId, reimbursedAt: input.entryDate ?? todayBogota(), updatedAt: nowIso() })
    .where(eq(financeEntries.id, id));
  await log("finance", id, "actualizado", `${e.concept}: reembolsado a ${e.payPerson ?? "—"}`, actor);
}

export async function deleteEntry(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const current = await getEntry(id);
  if (!current) return;
  await db.delete(financeEntries).where(eq(financeEntries.id, id));
  await log("finance", id, "eliminado", `${current.kind === "gasto" ? "Gasto" : "Ingreso"} · ${current.concept} · ${current.amount}`, actor);
}

// ---------- Lista de compras ----------

export async function createWishItem(missionId: string, input: WishItemInput, actor: string): Promise<WishItem> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${wishItems.position}), -1)` }).from(wishItems).where(eq(wishItems.missionId, missionId));
  const total = input.qty * input.unitCost;
  await db.insert(wishItems).values({
    id,
    missionId,
    name: input.name,
    detail: `${input.qty} × ${input.unitCost.toLocaleString("es-CO")}${input.note ? ` · ${input.note}` : ""}`,
    category: input.category,
    qty: input.qty,
    unitCost: input.unitCost,
    total,
    position: Number(n) + 1,
    status: "pendiente",
    notes: input.note,
    createdBy: actor,
  });
  await log("finance", id, "lista_agregado", `${input.name} · ${total}`, actor);
  return (await getWishItem(id))!;
}

/** Sube o baja un ítem una posición en la lista completa. */
export async function moveWishItem(id: string, direction: "up" | "down", actor: string): Promise<void> {
  const db = await getDb();
  const item = await getWishItem(id);
  if (!item) return;
  const list = await listWishItems(item.missionId);
  const idx = list.findIndex((w) => w.id === id);
  const j = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || j < 0 || j >= list.length) return;
  const other = list[j];
  const now = nowIso();
  // Posiciones normalizadas: el índice en la lista ordenada, intercambiando los dos.
  await Promise.all(
    list.map((w, i) => {
      const position = i === idx ? j : i === j ? idx : i;
      return db.update(wishItems).set({ position, updatedAt: now }).where(eq(wishItems.id, w.id));
    }),
  );
  await log("finance", id, "lista_ordenada", `${item.name} ${direction === "up" ? "↑" : "↓"} ${other.name}`, actor);
}

export async function buyWishItem(id: string, input: BuyInput, actor: string): Promise<WishItem | null> {
  const db = await getDb();
  const item = await getWishItem(id);
  if (!item || item.status === "comprado") return null;
  await db
    .update(wishItems)
    .set({ status: "comprado", fundId: input.fundId, boughtBy: input.boughtBy || null, reference: input.reference, boughtAt: input.entryDate ?? todayBogota(), updatedAt: nowIso() })
    .where(eq(wishItems.id, id));
  await log("finance", id, "lista_comprado", `${item.name} · ${item.total} · por ${input.boughtBy || actor}`, actor);
  return getWishItem(id);
}

export async function returnWishItem(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const item = await getWishItem(id);
  if (!item) return;
  await db.update(wishItems).set({ status: "pendiente", fundId: null, boughtBy: null, reference: null, boughtAt: null, updatedAt: nowIso() }).where(eq(wishItems.id, id));
  await log("finance", id, "lista_devuelto", item.name, actor);
}

export async function deleteWishItem(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const item = await getWishItem(id);
  if (!item) return;
  await db.delete(wishItems).where(eq(wishItems.id, id));
  await log("finance", id, "lista_eliminado", `${item.name} · ${item.total}`, actor);
}

// ---------- Tesorería ----------

export async function createTransfer(missionId: string, input: TransferInput, actor: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(financeTransfers).values({
    id,
    missionId,
    fromFundId: input.fromFundId,
    toFundId: input.toFundId,
    amount: input.amount,
    entryDate: input.entryDate ?? todayBogota(),
    performedBy: input.performedBy || null,
    note: input.note,
    createdBy: actor,
  });
  await log("finance", id, "traslado", `${input.amount} · ${input.fromFundId} → ${input.toFundId} · por ${input.performedBy || actor}`, actor);
  return id;
}

export async function deleteTransfer(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const t = (await db.select().from(financeTransfers).where(eq(financeTransfers.id, id)).limit(1))[0];
  if (!t) return;
  await db.delete(financeTransfers).where(eq(financeTransfers.id, id));
  await log("finance", id, "traslado_eliminado", `${t.amount}`, actor);
}

export async function createFund(missionId: string, input: FundInput, actor: string): Promise<FinanceFund> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${financeFunds.position}), -1)` }).from(financeFunds).where(eq(financeFunds.missionId, missionId));
  await db.insert(financeFunds).values({ id, missionId, ownerName: input.ownerName, type: input.type, label: input.label, active: true, position: Number(n) + 1, createdBy: actor });
  await log("finance", id, "cuenta_creada", `${input.label} (${input.ownerName} · ${input.type})`, actor);
  return (await getFund(id))!;
}

export async function setFundActive(id: string, active: boolean, actor: string): Promise<void> {
  const db = await getDb();
  const f = await getFund(id);
  if (!f) return;
  await db.update(financeFunds).set({ active, updatedAt: nowIso() }).where(eq(financeFunds.id, id));
  await log("finance", id, active ? "cuenta_activada" : "cuenta_desactivada", f.label, actor);
}

// ---------- Filtros para la exportación ----------

export type FinanceFilters = { q?: string; kind?: string; status?: string; category?: string; area?: string };

/** Filtros de Finanzas a partir de los parámetros de la URL; la descarga CSV usa la misma lógica. */
export function financeFiltersFromParams(p: Record<string, string | undefined>): Required<FinanceFilters> {
  return {
    q: (p.q ?? "").trim().slice(0, 120),
    kind: (p.tipo ?? "").slice(0, 20),
    status: (p.estado ?? "").slice(0, 20),
    category: (p.categoria ?? "").slice(0, 80), // admite varias separadas por coma
    area: (p.area ?? "").slice(0, 40),
  };
}

/** Filtro en memoria (los movimientos de una misión son pocos). */
export function filterEntries(rows: FinanceRow[], f: FinanceFilters): FinanceRow[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.kind && r.kind !== f.kind) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.category && !f.category.split(",").includes(r.category)) return false;
    if (f.area && (r.area ?? "") !== f.area) return false;
    if (q) {
      const hay = [r.concept, r.counterparty, r.reference, r.notes, r.registeredBy, r.payPerson, r.sub].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
