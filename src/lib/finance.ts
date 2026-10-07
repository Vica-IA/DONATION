import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { FINANCE_CATEGORIES, labelOf, type FinanceKind } from "./catalogs";
import { log } from "./data";
import { getDb } from "./db";
import { financeEntries, missionRegistrations, users, type FinanceEntry, type Mission } from "./db/schema";
import { nowIso } from "./format";
import type { DonationInput, FinanceEntryInput } from "./validation";

export type FinanceRow = FinanceEntry & { ownerName: string | null };

export async function listEntries(missionId: string): Promise<FinanceRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ entry: financeEntries, ownerName: users.name })
    .from(financeEntries)
    .leftJoin(users, eq(users.id, financeEntries.ownerUserId))
    .where(eq(financeEntries.missionId, missionId))
    .orderBy(sql`${financeEntries.entryDate} is null`, desc(financeEntries.entryDate), desc(financeEntries.createdAt), asc(financeEntries.concept));
  return rows.map((r) => ({ ...r.entry, ownerName: r.ownerName }));
}

export async function getEntry(id: string): Promise<FinanceRow | null> {
  const db = await getDb();
  const row = (
    await db
      .select({ entry: financeEntries, ownerName: users.name })
      .from(financeEntries)
      .leftJoin(users, eq(users.id, financeEntries.ownerUserId))
      .where(eq(financeEntries.id, id))
      .limit(1)
  )[0];
  return row ? { ...row.entry, ownerName: row.ownerName } : null;
}

function values(input: FinanceEntryInput) {
  return {
    kind: input.kind,
    status: input.status,
    category: input.category,
    area: input.area,
    concept: input.concept,
    amount: input.amount,
    entryDate: input.entryDate,
    counterparty: input.counterparty,
    reference: input.reference,
    ownerUserId: input.ownerUserId || null,
    notes: input.notes,
  };
}

function describe(input: { kind: string; concept: string; amount: number; status: string }): string {
  return `${input.kind === "gasto" ? "Gasto" : "Ingreso"} ${input.status} · ${input.concept} · ${input.amount}`;
}

export async function createEntry(missionId: string, input: FinanceEntryInput, actor: string): Promise<FinanceEntry> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(financeEntries).values({ id, missionId, ...values(input), createdBy: actor });
  await log("finance", id, "registrado", describe(input), actor);
  return (await db.select().from(financeEntries).where(eq(financeEntries.id, id)).limit(1))[0];
}

export async function updateEntry(id: string, input: FinanceEntryInput, actor: string): Promise<void> {
  const db = await getDb();
  const current = (await db.select().from(financeEntries).where(eq(financeEntries.id, id)).limit(1))[0];
  if (!current) throw new Error("Movimiento no encontrado");
  await db
    .update(financeEntries)
    .set({ ...values(input), updatedAt: nowIso() })
    .where(eq(financeEntries.id, id));
  const changes: string[] = [];
  if (current.amount !== input.amount) changes.push(`valor ${current.amount} → ${input.amount}`);
  if (current.status !== input.status) changes.push(`estado ${current.status} → ${input.status}`);
  await log("finance", id, "actualizado", `${describe(input)}${changes.length ? ` (${changes.join(", ")})` : ""}`, actor);
}

export async function deleteEntry(id: string, actor: string): Promise<void> {
  const db = await getDb();
  const current = (await db.select().from(financeEntries).where(eq(financeEntries.id, id)).limit(1))[0];
  if (!current) return;
  await db.delete(financeEntries).where(eq(financeEntries.id, id));
  await log("finance", id, "eliminado", describe(current), actor);
}

/** Aportes de las personas voluntarias, calculados desde las fichas (no se registran a mano). */
export type ContributionSummary = {
  confirmed: number;
  exempt: number;
  paidCount: number;
  perPerson: number;
  /** (confirmados − exentos) × aporte por persona. */
  projected: number;
  /** Suma de lo pagado (pagos completos y parciales). */
  received: number;
};

export async function contributionSummary(mission: Mission): Promise<ContributionSummary> {
  const db = await getDb();
  const per = mission.contributionAmount ?? 0;
  const row = (
    await db
      .select({
        confirmed: count(),
        exempt: sql<number>`coalesce(sum(case when ${missionRegistrations.paymentStatus} = 'exento' then 1 else 0 end), 0)`,
        paidCount: sql<number>`coalesce(sum(case when ${missionRegistrations.paymentStatus} in ('pagado', 'exento') then 1 else 0 end), 0)`,
        received: sql<number>`coalesce(sum(case
          when ${missionRegistrations.paymentStatus} = 'pagado' then coalesce(${missionRegistrations.paymentAmount}, ${per})
          when ${missionRegistrations.paymentStatus} = 'parcial' then coalesce(${missionRegistrations.paymentAmount}, 0)
          else 0 end), 0)`,
      })
      .from(missionRegistrations)
      .where(and(eq(missionRegistrations.missionId, mission.id), eq(missionRegistrations.status, "confirmado")))
  )[0];
  const confirmed = Number(row?.confirmed ?? 0);
  const exempt = Number(row?.exempt ?? 0);
  return {
    confirmed,
    exempt,
    paidCount: Number(row?.paidCount ?? 0),
    perPerson: per,
    projected: Math.max(0, confirmed - exempt) * per,
    received: Number(row?.received ?? 0),
  };
}

// ---------- Cálculos puros ----------

export type Totals = { proyectado: number; comprometido: number; ejecutado: number };

export type CategoryLine = Totals & {
  category: string;
  label: string;
  kind: FinanceKind;
  /** Presupuesto − comprometido − ejecutado (solo tiene sentido en gastos). */
  disponible: number;
  count: number;
  automatic?: boolean;
};

export type FinanceSummary = {
  gastos: Totals & { disponible: number };
  /** Incluye los aportes de voluntarios (proyectados y recibidos). */
  ingresos: Totals;
  aportes: ContributionSummary;
  /** Ingresos proyectados − presupuesto de gastos. */
  balanceProyectado: number;
  /** Ingresos recibidos − gastos ejecutados (caja). */
  balanceActual: number;
  /** Presupuesto de gastos − (ingresos recibidos + comprometidos), si es positivo. */
  faltante: number;
  porCategoria: CategoryLine[];
};

export const CONTRIBUTIONS_CATEGORY = "aportes_voluntarios";

const EMPTY: Totals = { proyectado: 0, comprometido: 0, ejecutado: 0 };

function add(t: Totals, status: string, amount: number): Totals {
  const next = { ...t };
  if (status === "proyectado" || status === "comprometido" || status === "ejecutado") next[status] += amount;
  return next;
}

export function summarizeFinance(entries: FinanceEntry[], aportes: ContributionSummary): FinanceSummary {
  let gastos: Totals = { ...EMPTY };
  let ingresos: Totals = { ...EMPTY };
  const byCategory = new Map<string, CategoryLine>();
  for (const e of entries) {
    if (e.kind === "gasto") gastos = add(gastos, e.status, e.amount);
    else ingresos = add(ingresos, e.status, e.amount);
    const line = byCategory.get(e.category) ?? {
      ...EMPTY,
      category: e.category,
      label: labelOf(FINANCE_CATEGORIES, e.category),
      kind: e.kind as FinanceKind,
      disponible: 0,
      count: 0,
    };
    const totals = add(line, e.status, e.amount);
    byCategory.set(e.category, { ...line, ...totals, count: line.count + 1 });
  }
  ingresos = { ...ingresos, proyectado: ingresos.proyectado + aportes.projected, ejecutado: ingresos.ejecutado + aportes.received };

  const order = new Map(FINANCE_CATEGORIES.map((c, i) => [c.value, i] as const));
  const porCategoria = [...byCategory.values()]
    .map((l) => ({ ...l, disponible: l.kind === "gasto" ? l.proyectado - l.comprometido - l.ejecutado : 0 }))
    .sort((a, b) => (order.get(a.category as never) ?? 99) - (order.get(b.category as never) ?? 99));
  if (aportes.projected > 0 || aportes.received > 0) {
    porCategoria.push({
      category: CONTRIBUTIONS_CATEGORY,
      label: "Aportes de voluntarios",
      kind: "ingreso",
      proyectado: aportes.projected,
      comprometido: 0,
      ejecutado: aportes.received,
      disponible: 0,
      count: aportes.confirmed,
      automatic: true,
    });
  }

  const disponible = gastos.proyectado - gastos.comprometido - gastos.ejecutado;
  return {
    gastos: { ...gastos, disponible },
    ingresos,
    aportes,
    balanceProyectado: ingresos.proyectado - gastos.proyectado,
    balanceActual: ingresos.ejecutado - gastos.ejecutado,
    faltante: Math.max(0, gastos.proyectado - ingresos.ejecutado - ingresos.comprometido),
    porCategoria,
  };
}

export type FinanceFilters = { q?: string; kind?: string; status?: string; category?: string; area?: string };

/** Filtros de Finanzas a partir de los parámetros de la URL; la página y la descarga CSV usan la misma lógica. */
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
      const hay = [r.concept, r.counterparty, r.reference, r.notes, r.ownerName].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sumAmounts(rows: FinanceRow[], kind: FinanceKind): number {
  return rows.filter((r) => r.kind === kind).reduce((acc, r) => acc + r.amount, 0);
}

// ---------- Donaciones ----------

/** Categorías de ingreso que son donaciones: en dinero y en especie (valor estimado). */
export const DONATION_CATEGORIES = ["donaciones", "donaciones_especie"] as const;

/** Traduce el formulario corto de donación a un movimiento de ingreso. */
export function donationToEntryInput(d: DonationInput): FinanceEntryInput {
  const inKind = d.donationType === "especie";
  return {
    kind: "ingreso",
    status: d.status === "recibida" ? "ejecutado" : "comprometido",
    category: inKind ? "donaciones_especie" : "donaciones",
    area: null,
    concept: d.description ?? `Donación de ${d.donor}`,
    amount: d.amount,
    entryDate: d.entryDate,
    counterparty: d.donor,
    reference: d.reference,
    ownerUserId: "",
    notes: d.notes,
  };
}

export function listDonations(rows: FinanceRow[]): FinanceRow[] {
  return rows.filter((r) => (DONATION_CATEGORIES as readonly string[]).includes(r.category));
}

export type DonationSummary = {
  /** Dinero ya recibido. */
  received: number;
  /** Valor estimado de lo recibido en especie. */
  inKind: number;
  /** Prometido (dinero o especie) que todavía no llega. */
  promised: number;
  donors: number;
  count: number;
};

export function summarizeDonations(rows: FinanceRow[]): DonationSummary {
  const out: DonationSummary = { received: 0, inKind: 0, promised: 0, donors: 0, count: rows.length };
  const donors = new Set<string>();
  for (const r of rows) {
    if (r.counterparty?.trim()) donors.add(r.counterparty.trim().toLowerCase());
    if (r.status === "ejecutado") {
      if (r.category === "donaciones_especie") out.inKind += r.amount;
      else out.received += r.amount;
    } else if (r.status === "comprometido") out.promised += r.amount;
  }
  out.donors = donors.size;
  return out;
}
