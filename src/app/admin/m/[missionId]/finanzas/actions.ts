"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMissionById } from "@/lib/data";
import {
  buyWishItem,
  createExpense,
  createFund,
  createIncome,
  createTransfer,
  createWishItem,
  cycleExpenseStatus,
  deleteEntry,
  deleteTransfer,
  deleteWishItem,
  getEntry,
  listFunds,
  markReimbursed,
  moveWishItem,
  returnWishItem,
  setFundActive,
  toggleIncomeStatus,
} from "@/lib/finance";
import { formatCOP } from "@/lib/format";
import { canManageFinance } from "@/lib/permissions";
import { buySchema, expenseSchema, flattenErrors, formToObject, fundSchema, incomeSchema, reimburseSchema, transferSchema, wishItemSchema, type FieldErrors } from "@/lib/validation";

export type ModalState = { errors: FieldErrors; values: Record<string, unknown> };

const NO_PERMISSION: ModalState = { errors: { _form: "Solo el administrador y la coordinación de Financiero registran movimientos." }, values: {} };
const MODAL_PARAMS = ["nuevo", "comprar", "traslado", "cuentas", "reembolso", "msg"];

function financePath(missionId: string) {
  return `/admin/m/${missionId}/finanzas`;
}

/** Vuelve a Finanzas conservando los filtros de la vista, cierra el modal y muestra un mensaje. */
function finish(missionId: string, returnTo: unknown, msg: string, keep: string[] = []): never {
  revalidatePath(`/admin/m/${missionId}`, "layout");
  const base = typeof returnTo === "string" && returnTo.startsWith(financePath(missionId)) ? returnTo : financePath(missionId);
  const url = new URL(base, "http://local");
  for (const p of MODAL_PARAMS) if (!keep.includes(p)) url.searchParams.delete(p);
  url.searchParams.set("msg", msg);
  redirect(`${url.pathname}${url.search}`);
}

async function manager(missionId: string) {
  const user = await requireUser(financePath(missionId));
  const mission = await getMissionById(missionId);
  return { user, mission, allowed: Boolean(mission) && canManageFinance(user) };
}

async function firstActiveFund(missionId: string): Promise<string | null> {
  return (await listFunds(missionId)).find((f) => f.active)?.id ?? null;
}

// ---------- Modales (useActionState) ----------

export async function createIncomeAction(missionId: string, _prev: ModalState, formData: FormData): Promise<ModalState> {
  const { user, mission, allowed } = await manager(missionId);
  if (!allowed || !mission) return NO_PERMISSION;
  const raw = formToObject(formData);
  const parsed = incomeSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  const who = await createIncome(mission, parsed.data, user.name);
  finish(missionId, raw.returnTo, `Ingreso registrado: ${who} · ${formatCOP(parsed.data.amount)}${parsed.data.status === "estimado" ? " (estimado)" : ""}`);
}

export async function createExpenseAction(missionId: string, _prev: ModalState, formData: FormData): Promise<ModalState> {
  const { user, mission, allowed } = await manager(missionId);
  if (!allowed || !mission) return NO_PERMISSION;
  const raw = formToObject(formData);
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  await createExpense(missionId, parsed.data, user.name);
  const d = parsed.data;
  const pago = d.status === "pagado" ? (d.payKind === "person" ? ` · adelantó ${d.payPerson}` : " · pagado desde la cuenta") : "";
  finish(missionId, raw.returnTo, `Gasto agregado: ${d.concept} · ${formatCOP(d.amount)}${pago}`);
}

export async function createWishItemAction(missionId: string, _prev: ModalState, formData: FormData): Promise<ModalState> {
  const { user, mission, allowed } = await manager(missionId);
  if (!allowed || !mission) return NO_PERMISSION;
  const raw = formToObject(formData);
  const parsed = wishItemSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  const item = await createWishItem(missionId, parsed.data, user.name);
  finish(missionId, raw.returnTo, `Agregado a la lista: ${item.name} · ${formatCOP(item.total)}`);
}

export async function buyWishItemAction(missionId: string, wishId: string, _prev: ModalState, formData: FormData): Promise<ModalState> {
  const { user, mission, allowed } = await manager(missionId);
  if (!allowed || !mission) return NO_PERMISSION;
  const raw = formToObject(formData);
  const parsed = buySchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  const item = await buyWishItem(wishId, parsed.data, user.name);
  if (!item) return { errors: { _form: "Ese ítem ya no está pendiente." }, values: raw };
  finish(missionId, raw.returnTo, `Compra registrada: ${item.name} · ${formatCOP(item.total)}. Ahora aparece en Gastos · Materiales.`);
}

export async function createTransferAction(missionId: string, _prev: ModalState, formData: FormData): Promise<ModalState> {
  const { user, mission, allowed } = await manager(missionId);
  if (!allowed || !mission) return NO_PERMISSION;
  const raw = formToObject(formData);
  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  await createTransfer(missionId, parsed.data, user.name);
  finish(missionId, raw.returnTo, `Traslado registrado: ${formatCOP(parsed.data.amount)}`);
}

export async function createFundAction(missionId: string, _prev: ModalState, formData: FormData): Promise<ModalState> {
  const { user, mission, allowed } = await manager(missionId);
  if (!allowed || !mission) return NO_PERMISSION;
  const raw = formToObject(formData);
  const parsed = fundSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  const fund = await createFund(missionId, parsed.data, user.name);
  finish(missionId, raw.returnTo, `Cuenta creada: ${fund.label}`, ["cuentas"]);
}

export async function markReimbursedAction(missionId: string, entryId: string, _prev: ModalState, formData: FormData): Promise<ModalState> {
  const { user, mission, allowed } = await manager(missionId);
  if (!allowed || !mission) return NO_PERMISSION;
  const entry = await getEntry(entryId);
  if (!entry || entry.missionId !== missionId) return { errors: { _form: "El gasto no existe." }, values: {} };
  const raw = formToObject(formData);
  const parsed = reimburseSchema.safeParse(raw);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values: raw };
  await markReimbursed(entryId, parsed.data, user.name);
  finish(missionId, raw.returnTo, `Reembolso registrado: ${entry.concept} · ${formatCOP(entry.amount)}`);
}

// ---------- Botones (un clic) ----------

async function quick(missionId: string, formData: FormData, run: (actor: string) => Promise<string>): Promise<never> {
  const { user, mission, allowed } = await manager(missionId);
  if (!allowed || !mission) redirect(`/admin/m/${missionId}?denegado=1`);
  const msg = await run(user.name);
  finish(missionId, formData.get("returnTo"), msg);
}

export async function toggleIncomeStatusAction(missionId: string, entryId: string, formData: FormData): Promise<void> {
  await quick(missionId, formData, async (actor) => {
    const entry = await getEntry(entryId);
    if (!entry || entry.missionId !== missionId) return "El ingreso no existe.";
    await toggleIncomeStatus(entryId, await firstActiveFund(missionId), actor);
    return `${entry.concept}: ${entry.status === "ejecutado" ? "vuelve a estimado" : "marcado como recibido"}`;
  });
}

export async function cycleExpenseStatusAction(missionId: string, entryId: string, formData: FormData): Promise<void> {
  await quick(missionId, formData, async (actor) => {
    const entry = await getEntry(entryId);
    if (!entry || entry.missionId !== missionId) return "El gasto no existe.";
    const next = await cycleExpenseStatus(entryId, await firstActiveFund(missionId), actor);
    return `${entry.concept}: ${next ?? "sin cambios"}`;
  });
}

export async function deleteEntryAction(missionId: string, entryId: string, formData: FormData): Promise<void> {
  await quick(missionId, formData, async (actor) => {
    const entry = await getEntry(entryId);
    if (!entry || entry.missionId !== missionId) return "El movimiento no existe.";
    await deleteEntry(entryId, actor);
    return `Eliminado: ${entry.concept}`;
  });
}

export async function moveWishItemAction(missionId: string, wishId: string, formData: FormData): Promise<void> {
  await quick(missionId, formData, async (actor) => {
    await moveWishItem(wishId, formData.get("direction") === "up" ? "up" : "down", actor);
    return "Prioridad actualizada";
  });
}

export async function returnWishItemAction(missionId: string, wishId: string, formData: FormData): Promise<void> {
  await quick(missionId, formData, async (actor) => {
    await returnWishItem(wishId, actor);
    return "El ítem volvió a la lista de compras";
  });
}

export async function deleteWishItemAction(missionId: string, wishId: string, formData: FormData): Promise<void> {
  await quick(missionId, formData, async (actor) => {
    await deleteWishItem(wishId, actor);
    return "Ítem eliminado de la lista";
  });
}

export async function toggleFundAction(missionId: string, fundId: string, formData: FormData): Promise<void> {
  const { user, mission, allowed } = await manager(missionId);
  if (!allowed || !mission) redirect(`/admin/m/${missionId}?denegado=1`);
  const active = formData.get("active") === "1";
  await setFundActive(fundId, active, user.name);
  finish(missionId, formData.get("returnTo"), active ? "Cuenta activada" : "Cuenta desactivada", ["cuentas"]);
}

export async function deleteTransferAction(missionId: string, transferId: string, formData: FormData): Promise<void> {
  await quick(missionId, formData, async (actor) => {
    await deleteTransfer(transferId, actor);
    return "Traslado eliminado";
  });
}
