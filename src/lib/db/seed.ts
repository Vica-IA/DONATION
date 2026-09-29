import { count } from "drizzle-orm";
import type { Db } from "./index";
import { missions, organizations } from "./schema";

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
      code: "CHO-2026-01",
      slug: "choco-2026-01",
      name: "Misión Chocó 01",
      description:
        "Primera misión de campo de DONATO: reconstrucción de una vivienda y acompañamiento integral a una familia afectada en el Chocó. Grupos aliados: KAIROS Life y PALPITOS.",
      location: "Chocó, Colombia (territorio por confirmar: Quibdó, Tadó, Ánimas o Puerto Meluk)",
      startDate: "2026-10-09",
      endDate: "2026-10-12",
      capacity: 40,
      status: "convocatoria",
      registrationOpen: true,
      meetingPoint: "Medellín (punto y hora por confirmar)",
    });
  }
}
