import { count, eq } from "drizzle-orm";
import type { Db } from "./index";
import { missions, organizations, tasks, users } from "./schema";
import { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, hashPassword } from "../password";
import { KAIROS_ETAPA2_DECLARATIONS, KAIROS_ETAPA2_TERMS_MARKDOWN, KAIROS_ETAPA2_TERMS_VERSION } from "../terms/kairos-etapa2";

const SEED_MISSION_CODE = "CHO-2026-01";

/**
 * Datos iniciales del primer caso de uso (Misión Chocó). Solo se insertan si
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
      name: "Misión Chocó 01",
      description:
        "Primera misión de campo de DONATION: reconstrucción de una vivienda y acompañamiento integral a una familia afectada en el Chocó. Grupos aliados: Grupo Kairós y Fundación Pálpitos.",
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
