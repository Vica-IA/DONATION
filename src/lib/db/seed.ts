import { and, count, eq } from "drizzle-orm";
import type { Db } from "./index";
import { activityLog, appSettings, financeEntries, missions, organizations, tasks, users } from "./schema";
import { nowIso } from "../format";
import { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, hashPassword } from "../password";
import { KAIROS_ETAPA2_DECLARATIONS, KAIROS_ETAPA2_TERMS_MARKDOWN, KAIROS_ETAPA2_TERMS_VERSION } from "../terms/kairos-etapa2";

const SEED_MISSION_CODE = "CHO-2026-01";
const SEED_MISSION_NAME = "Misión Levantar Chocó";
/** Nombre provisional con el que se creó la misión en las primeras bases. */
const LEGACY_MISSION_NAME = "Misión Chocó 01";

/**
 * Datos iniciales del primer caso de uso (Misión Levantar Chocó). Solo se insertan si
 * la base está vacía, así que es seguro ejecutarlo en cada arranque.
 */
export async function seedIfEmpty(db: Db) {
  const [{ value: orgCount }] = await db.select({ value: count() }).from(organizations);
  if (orgCount === 0) {
    await db.insert(organizations).values([
      { id: crypto.randomUUID(), slug: "grupo-kairos", name: "Grupo Kairós" },
      { id: crypto.randomUUID(), slug: "fundacion-palpitos", name: "Fundación Pálpitos" },
    ]);
  }

  const [{ value: missionCount }] = await db.select({ value: count() }).from(missions);
  if (missionCount === 0) {
    await db.insert(missions).values({
      id: crypto.randomUUID(),
      code: SEED_MISSION_CODE,
      slug: "choco-2026-01",
      name: SEED_MISSION_NAME,
      description: null,
      departureNote: "Viernes 9 de octubre, 6:00 p. m.",
      returnNote: "Lunes 12 de octubre, 11:00 p. m.",
      location: "Chocó, Colombia (Tadó, Istmina y comunidades cercanas a Puerto Meluk; por confirmar)",
      startDate: "2026-10-09",
      endDate: "2026-10-12",
      capacity: 40,
      status: "convocatoria",
      registrationOpen: true,
      meetingPoint: "Medellín (punto y hora por confirmar)",
      contributionAmount: 400000,
      termsMarkdown: KAIROS_ETAPA2_TERMS_MARKDOWN,
      termsDeclarations: KAIROS_ETAPA2_DECLARATIONS.join("\n"),
      termsVersion: KAIROS_ETAPA2_TERMS_VERSION,
      termsImageConsent: true,
    });
  }

  // Bases creadas con los nombres provisionales de los grupos: aplicar los nombres oficiales.
  await db.update(organizations).set({ name: "Grupo Kairós", slug: "grupo-kairos" }).where(eq(organizations.slug, "kairos-life"));
  await db.update(organizations).set({ name: "Fundación Pálpitos", slug: "fundacion-palpitos" }).where(eq(organizations.slug, "palpitos"));

  // Bases creadas con el nombre provisional de la misión: aplicar el nombre oficial (solo si nadie lo editó).
  await db
    .update(missions)
    .set({ name: SEED_MISSION_NAME })
    .where(and(eq(missions.code, SEED_MISSION_CODE), eq(missions.name, LEGACY_MISSION_NAME)));

  // Bases creadas antes de existir las condiciones: cargar el documento inicial una sola vez.
  const seeded = (await db.select().from(missions).where(eq(missions.code, SEED_MISSION_CODE)).limit(1))[0];
  if (seeded && !seeded.termsMarkdown) {
    await db
      .update(missions)
      .set({
        termsMarkdown: KAIROS_ETAPA2_TERMS_MARKDOWN,
        termsDeclarations: KAIROS_ETAPA2_DECLARATIONS.join("\n"),
        termsVersion: KAIROS_ETAPA2_TERMS_VERSION,
        contributionAmount: seeded.contributionAmount ?? 400000,
      })
      .where(eq(missions.id, seeded.id));
  }
}

/**
 * Garantiza la cuenta de administrador configurada en el entorno.
 * - Producción: toma ADMIN_EMAIL y ADMIN_PASSWORD del entorno.
 * - Desarrollo: si no están definidos, usa las credenciales de desarrollo.
 * Si ya existe un usuario con ese correo no se toca (ni su contraseña ni su
 * rol). Si no existe, se crea como administrador aunque haya otros usuarios,
 * para que cambiar ADMIN_EMAIL en el entorno siempre dé acceso.
 */
export async function ensureBootstrapAdmin(db: Db) {
  const isProd = process.env.NODE_ENV === "production";
  const email = (process.env.ADMIN_EMAIL ?? (isProd ? "" : DEV_ADMIN_EMAIL)).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? (isProd ? "" : DEV_ADMIN_PASSWORD);
  if (!email || !password) {
    const [{ value: userCount }] = await db.select({ value: count() }).from(users);
    if (userCount === 0) {
      console.warn(
        "DONATION: no hay usuarios del panel. Define ADMIN_EMAIL y ADMIN_PASSWORD en el entorno para crear el primer administrador.",
      );
    }
    return;
  }

  if (await applyAdminRescue(db, email, password)) return;

  const existing = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
  if (existing) return;

  await db.insert(users).values({
    id: crypto.randomUUID(),
    email,
    name: process.env.ADMIN_NAME ?? "Administrador",
    role: "admin",
    passwordHash: await hashPassword(password),
    active: true,
    // Las credenciales vienen del entorno (o son las de desarrollo): no obligan a cambiarlas.
    mustChangePassword: false,
  });
  console.info(`DONATION: administrador creado desde el entorno (${email}).`);
}

const RESCUE_SETTING = "admin_password_reset";

/**
 * Rescate del administrador por variable de entorno. Si ADMIN_PASSWORD_RESET
 * trae un valor que no se ha aplicado antes, la cuenta de ADMIN_EMAIL vuelve a
 * ser administrador activo con la contraseña de ADMIN_PASSWORD, marcada como
 * temporal (hay que cambiarla al entrar). Cada valor se aplica una sola vez y
 * queda anotado en app_settings, así que la variable puede quedarse sin que
 * cada arranque (o cada instancia en Vercel) vuelva a restablecerla.
 */
async function applyAdminRescue(db: Db, email: string, password: string): Promise<boolean> {
  const marker = (process.env.ADMIN_PASSWORD_RESET ?? "").trim();
  if (!marker) return false;
  const applied = (await db.select().from(appSettings).where(eq(appSettings.key, RESCUE_SETTING)).limit(1))[0];
  if (applied?.value === marker) return false;

  const now = nowIso();
  const passwordHash = await hashPassword(password);
  const existing = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
  let userId = existing?.id;
  if (userId) {
    await db
      .update(users)
      .set({ passwordHash, role: "admin", active: true, mustChangePassword: true, passwordChangedAt: now, updatedAt: now })
      .where(eq(users.id, userId));
  } else {
    userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      email,
      name: process.env.ADMIN_NAME ?? "Administrador",
      role: "admin",
      passwordHash,
      active: true,
      mustChangePassword: true,
    });
  }
  await db
    .insert(appSettings)
    .values({ key: RESCUE_SETTING, value: marker, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: marker, updatedAt: now } });
  await db.insert(activityLog).values({
    id: crypto.randomUUID(),
    entityType: "user",
    entityId: userId,
    action: "rescate_admin",
    detail: `ADMIN_PASSWORD_RESET=${marker}: acceso de administrador restablecido con contraseña temporal`,
    actor: "sistema",
  });
  console.warn(`DONATION: rescate del administrador aplicado (${email}). Entra con ADMIN_PASSWORD y cámbiala.`);
  return true;
}

/**
 * Tareas iniciales de la primera misión, tomadas del Master Plan (08.00 §3 y §21).
 * Solo se cargan si la misión semilla todavía no tiene tareas.
 */
const SEED_TASKS: { area: string; title: string; due: string; go?: boolean }[] = [
  // Criterios Go / No-Go (08.00 §21) — cierre operativo 6–8 de octubre
  { area: "general", title: "Familia verificada", due: "2026-10-08", go: true },
  { area: "general", title: "Vivienda seleccionada y diagnóstico técnico", due: "2026-10-08", go: true },
  { area: "general", title: "Diseño o solución constructiva definida", due: "2026-10-08", go: true },
  { area: "financiero", title: "Presupuesto aprobado", due: "2026-10-08", go: true },
  { area: "financiero", title: "Recursos disponibles o comprometidos formalmente", due: "2026-10-08", go: true },
  { area: "transporte", title: "Materiales críticos asegurados", due: "2026-10-08", go: true },
  { area: "transporte", title: "Transporte confirmado", due: "2026-10-08", go: true },
  { area: "general", title: "Equipo confirmado y roles asignados", due: "2026-10-08", go: true },
  { area: "logistica", title: "Alojamiento confirmado", due: "2026-10-08", go: true },
  { area: "alimentacion", title: "Alimentación confirmada", due: "2026-10-08", go: true },
  { area: "logistica", title: "Herramientas y equipos de protección disponibles", due: "2026-10-08", go: true },
  { area: "logistica", title: "Plan de seguridad revisado", due: "2026-10-08", go: true },
  { area: "general", title: "Responsable técnico y responsable financiero definidos", due: "2026-10-08", go: true },
  { area: "espiritual", title: "Contacto local confirmado (sacerdote y líder comunitario)", due: "2026-10-08", go: true },
  { area: "general", title: "Documentación y formatos de campo preparados", due: "2026-10-08", go: true },
  { area: "general", title: "Sistema DONATION operativo", due: "2026-10-08", go: true },
  // Tareas por área (08.00 §3)
  { area: "general", title: "Definir equipo de liderazgo y responsables", due: "2026-09-20" },
  { area: "general", title: "Confirmar 40 voluntarios", due: "2026-10-02" },
  { area: "general", title: "Capacitación de voluntarios", due: "2026-10-02" },
  { area: "general", title: "Auditoría de preparación", due: "2026-10-05" },
  { area: "logistica", title: "Confirmar alojamiento del equipo", due: "2026-09-28" },
  { area: "logistica", title: "Confirmar herramientas y equipos de protección", due: "2026-09-28" },
  { area: "logistica", title: "Botiquín y protocolo de emergencias", due: "2026-10-02" },
  { area: "logistica", title: "Energía y conectividad en campo", due: "2026-10-03" },
  { area: "alimentacion", title: "Definir menú de 4 días y raciones", due: "2026-10-01" },
  { area: "alimentacion", title: "Registrar restricciones alimentarias del equipo", due: "2026-10-02" },
  { area: "alimentacion", title: "Compras de víveres y agua potable", due: "2026-10-05" },
  { area: "transporte", title: "Cotizar y contratar transporte Medellín → Chocó", due: "2026-09-28" },
  { area: "transporte", title: "Planificar transporte de materiales a la obra", due: "2026-10-02" },
  { area: "transporte", title: "Asignar puestos por grupo", due: "2026-10-05" },
  { area: "transporte", title: "Confirmar traslados internos alojamiento ↔ obra", due: "2026-10-05" },
  { area: "financiero", title: "Cotizar materiales faltantes", due: "2026-09-27" },
  { area: "financiero", title: "Separar recursos disponibles y comprometidos", due: "2026-09-28" },
  { area: "financiero", title: "Preparar formato de gastos diarios de campo", due: "2026-10-02" },
  { area: "financiero", title: "Definir caja menor de campo con doble aprobación", due: "2026-10-03" },
  { area: "espiritual", title: "Confirmar agenda con sacerdote y líder comunitario", due: "2026-10-02" },
  { area: "espiritual", title: "Preparar oraciones diarias y Eucaristía comunitaria", due: "2026-10-05" },
  { area: "emocional", title: "Plan de actividades con niños y familias", due: "2026-10-01" },
  { area: "emocional", title: "Capacitación en primeros auxilios psicológicos", due: "2026-10-02" },
  { area: "emocional", title: "Consentimiento para testimonios e imágenes", due: "2026-10-03" },
];

export async function seedTasksIfEmpty(db: Db) {
  const mission = (await db.select().from(missions).where(eq(missions.code, SEED_MISSION_CODE)).limit(1))[0];
  if (!mission) return;
  const [{ value: n }] = await db.select({ value: count() }).from(tasks).where(eq(tasks.missionId, mission.id));
  if (n > 0) return;
  await db.insert(tasks).values(
    SEED_TASKS.map((t) => ({
      id: crypto.randomUUID(),
      missionId: mission.id,
      area: t.area,
      title: t.title,
      dueDate: t.due,
      status: "pendiente",
      isGoCriteria: Boolean(t.go),
      createdBy: "sistema",
    })),
  );
}

const FINANCE_PLAN_SETTING = "finance_plan_seeded";

/** Plan financiero inicial de la misión semilla (lista de Financiero, octubre de 2026). Todo proyectado: es el presupuesto. */
const SEED_FINANCE_PLAN: { kind: "gasto" | "ingreso"; category: string; area?: string; concept: string; amount: number; counterparty?: string }[] = [
  { kind: "ingreso", category: "donaciones", concept: "Donación Grupo Kairós", amount: 10_000_000, counterparty: "Grupo Kairós" },
  { kind: "ingreso", category: "donaciones", concept: "Donación Fundación Pálpitos (aprox.)", amount: 2_000_000, counterparty: "Fundación Pálpitos" },
  { kind: "gasto", category: "transporte", area: "transporte", concept: "Bus Medellín – Chocó (ida y regreso)", amount: 6_500_000 },
  { kind: "gasto", category: "transporte", area: "transporte", concept: "4 buses a Puerto Meluk (ida y vuelta)", amount: 4_000_000 },
  { kind: "gasto", category: "transporte", area: "transporte", concept: "Gasolina de las lanchas", amount: 3_230_000 },
  { kind: "gasto", category: "transporte", area: "transporte", concept: "Motoristas", amount: 1_200_000 },
  { kind: "gasto", category: "alimentacion", area: "alimentacion", concept: "Alimentación y abastecimientos", amount: 3_000_000 },
  { kind: "gasto", category: "materiales", concept: "Materiales (presupuesto asignado)", amount: 6_000_000 },
  { kind: "gasto", category: "actividades", concept: "Tienda y actividades (presupuesto asignado)", amount: 230_000 },
];

/**
 * Carga el plan financiero inicial de la misión semilla una sola vez: solo si
 * la misión todavía no tiene presupuesto (ningún gasto proyectado) y no se ha
 * intentado antes (marca en app_settings). Después se edita desde Finanzas;
 * aunque se borre, no se vuelve a cargar.
 */
export async function seedFinancePlanIfEmpty(db: Db) {
  const mission = (await db.select().from(missions).where(eq(missions.code, SEED_MISSION_CODE)).limit(1))[0];
  if (!mission) return;
  const key = `${FINANCE_PLAN_SETTING}:${mission.id}`;
  const done = (await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1))[0];
  if (done) return;
  const now = nowIso();
  const [{ value: budgeted }] = await db
    .select({ value: count() })
    .from(financeEntries)
    .where(and(eq(financeEntries.missionId, mission.id), eq(financeEntries.kind, "gasto"), eq(financeEntries.status, "proyectado")));
  if (budgeted === 0) {
    await db.insert(financeEntries).values(
      SEED_FINANCE_PLAN.map((e) => ({
        id: crypto.randomUUID(),
        missionId: mission.id,
        kind: e.kind,
        status: "proyectado",
        category: e.category,
        area: e.area ?? null,
        concept: e.concept,
        amount: e.amount,
        counterparty: e.counterparty ?? null,
        notes: "Plan inicial de la misión (lista de Financiero, octubre de 2026).",
        createdBy: "sistema",
      })),
    );
    await db.insert(activityLog).values({
      id: crypto.randomUUID(),
      entityType: "finance",
      entityId: mission.id,
      action: "plan_inicial_cargado",
      detail: `${SEED_FINANCE_PLAN.length} movimientos proyectados del plan inicial de Financiero`,
      actor: "sistema",
    });
  }
  await db
    .insert(appSettings)
    .values({ key, value: now, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: now, updatedAt: now } });
}
