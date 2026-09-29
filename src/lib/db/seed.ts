import { count, eq } from "drizzle-orm";
import type { Db } from "./index";
import { missions, organizations, users } from "./schema";
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
      { id: crypto.randomUUID(), slug: "kairos-life", name: "KAIROS Life" },
      { id: crypto.randomUUID(), slug: "palpitos", name: "PALPITOS" },
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
        "Primera misión de campo de DONATION: reconstrucción de una vivienda y acompañamiento integral a una familia afectada en el Chocó. Grupos aliados: KAIROS Life y PALPITOS.",
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
 * Crea el primer administrador si no existe ningún usuario.
 * - Producción: toma ADMIN_EMAIL y ADMIN_PASSWORD del entorno.
 * - Desarrollo: si no están definidos, usa las credenciales de desarrollo.
 */
export async function ensureBootstrapAdmin(db: Db) {
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  if (userCount > 0) return;

  const isProd = process.env.NODE_ENV === "production";
  const email = (process.env.ADMIN_EMAIL ?? (isProd ? "" : DEV_ADMIN_EMAIL)).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? (isProd ? "" : DEV_ADMIN_PASSWORD);
  if (!email || !password) {
    console.warn(
      "DONATION: no hay usuarios del panel. Define ADMIN_EMAIL y ADMIN_PASSWORD en el entorno para crear el primer administrador.",
    );
    return;
  }

  await db.insert(users).values({
    id: crypto.randomUUID(),
    email,
    name: process.env.ADMIN_NAME ?? "Administrador",
    role: "admin",
    passwordHash: await hashPassword(password),
    active: true,
    // Las credenciales de desarrollo son públicas: no obligan a cambiarlas.
    mustChangePassword: false,
  });
  console.info(`DONATION: administrador inicial creado (${email}).`);
}
