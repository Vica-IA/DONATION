/**
 * Resumen de datos de la base (solo conteos y fechas, sin datos personales).
 * Se ejecuta después del build para dejar en el registro del despliegue una
 * foto del estado real de la base: cuántas inscripciones hay, a qué misión
 * apuntan, si hay huérfanas y qué acciones registra la bitácora.
 * Nunca hace fallar el build: cualquier error se imprime y termina en 0.
 */
import { createClient } from "@libsql/client";

const PREFIX = "DONATION resumen:";

function dbTarget(): { url: string; authToken?: string; label: string } {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? process.env.LIBSQL_URL;
  if (url) return { url, authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN, label: "remota" };
  return { url: "file:./data/donation.db", label: "local" };
}

async function main() {
  const target = dbTarget();
  const client = createClient({ url: target.url, authToken: target.authToken });
  const q = async (sql: string) => (await client.execute(sql)).rows;
  const tables = (await q(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)).map((r) => String(r.name));
  let host = "";
  try {
    host = target.label === "remota" ? new URL(target.url.replace(/^(libsql|wss?):/i, "https:")).host : "";
  } catch {
    host = "";
  }
  console.log(`${PREFIX} base ${target.label}${host ? ` (${host})` : ""}; tablas: ${tables.join(", ") || "(ninguna)"}`);
  const has = (t: string) => tables.includes(t);

  for (const t of ["missions", "volunteers", "mission_registrations", "terms_acceptances", "users", "activity_log", "_migrations"]) {
    if (!has(t)) {
      console.log(`${PREFIX} ${t}: (no existe)`);
      continue;
    }
    const n = (await q(`SELECT COUNT(*) AS n FROM ${t}`))[0].n;
    console.log(`${PREFIX} ${t}: ${n} filas`);
  }

  if (has("missions")) {
    for (const m of await q(`SELECT id, code, name, created_at FROM missions ORDER BY created_at`)) {
      console.log(`${PREFIX} misión ${String(m.id).slice(0, 8)}… ${m.code} "${m.name}" creada ${m.created_at}`);
    }
  }
  if (has("mission_registrations")) {
    const rows = await q(
      `SELECT r.mission_id AS mid, COUNT(*) AS n, MIN(r.created_at) AS primera, MAX(r.created_at) AS ultima,
              (SELECT COUNT(*) FROM missions m WHERE m.id = r.mission_id) AS existe
       FROM mission_registrations r GROUP BY r.mission_id`,
    );
    for (const r of rows) {
      console.log(`${PREFIX} inscripciones con misión ${String(r.mid).slice(0, 8)}… (${Number(r.existe) ? "existe" : "NO EXISTE"}): ${r.n}, primera ${r.primera}, última ${r.ultima}`);
    }
    const porEstado = await q(`SELECT status, COUNT(*) AS n FROM mission_registrations GROUP BY status`);
    console.log(`${PREFIX} por estado: ${porEstado.map((r) => `${r.status}=${r.n}`).join(", ") || "(ninguna)"}`);
    if (has("volunteers")) {
      const sinPersona = (await q(`SELECT COUNT(*) AS n FROM mission_registrations r WHERE NOT EXISTS (SELECT 1 FROM volunteers v WHERE v.id = r.volunteer_id)`))[0].n;
      const sinInscripcion = (await q(`SELECT COUNT(*) AS n FROM volunteers v WHERE NOT EXISTS (SELECT 1 FROM mission_registrations r WHERE r.volunteer_id = v.id)`))[0].n;
      console.log(`${PREFIX} inscripciones sin persona: ${sinPersona}; personas sin inscripción: ${sinInscripcion}`);
    }
  }
  if (has("activity_log")) {
    const acciones = await q(`SELECT entity_type, action, COUNT(*) AS n FROM activity_log GROUP BY entity_type, action ORDER BY entity_type, action`);
    console.log(`${PREFIX} bitácora: ${acciones.map((r) => `${r.entity_type}.${r.action}=${r.n}`).join(", ") || "(vacía)"}`);
    for (const a of await q(`SELECT created_at, entity_type, action, actor FROM activity_log ORDER BY created_at DESC LIMIT 25`)) {
      console.log(`${PREFIX} bitácora ${a.created_at} ${a.entity_type}.${a.action} por ${a.actor}`);
    }
  }
  if (has("_migrations")) {
    const m = await q(`SELECT id, applied_at FROM _migrations ORDER BY applied_at`);
    console.log(`${PREFIX} migraciones: ${m.map((r) => `${r.id}@${r.applied_at}`).join(" | ")}`);
  }
  client.close();
}

main()
  .catch((err) => console.log(`${PREFIX} no se pudo leer la base: ${err instanceof Error ? err.message : String(err)}`))
  .finally(() => process.exit(0));
