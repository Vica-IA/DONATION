import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { MIGRATIONS } from "./migrations";
import { ensureBootstrapAdmin, seedIfEmpty, seedTasksIfEmpty } from "./seed";

export type Db = LibSQLDatabase<typeof schema>;

const LOCAL_URL = "file:./data/donation.db";
const EPHEMERAL_URL = "file:/tmp/donation.db";

/**
 * Credenciales de la base remota (Turso / libSQL). Acepta los nombres
 * habituales y, como respaldo, cualquier variable cuyo valor empiece por
 * libsql:// (las integraciones a veces cambian el prefijo del nombre).
 */
export function remoteDbEnv(): { url: string; authToken?: string; key: string } | null {
  const candidates: [string, string][] = [
    ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
    ["DATABASE_URL", "DATABASE_AUTH_TOKEN"],
    ["LIBSQL_URL", "LIBSQL_AUTH_TOKEN"],
  ];
  for (const [urlKey, tokenKey] of candidates) {
    const url = process.env[urlKey];
    if (url) return { url, authToken: process.env[tokenKey] ?? process.env.TURSO_AUTH_TOKEN, key: urlKey };
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || !/^(libsql|https?|wss?):\/\/.+\.turso\.io/i.test(value) && !value.startsWith("libsql://")) continue;
    const base = key.replace(/_?(DATABASE_)?URL$/i, "");
    const authToken =
      process.env[`${base}_AUTH_TOKEN`] ?? process.env[`${base}_TOKEN`] ?? process.env[`${base}_DATABASE_AUTH_TOKEN`] ?? process.env.TURSO_AUTH_TOKEN;
    return { url: value, authToken, key };
  }
  return null;
}

export type DbMode = "turso" | "ephemeral" | "local";

/** Qué base se está usando: remota (Turso), temporal (/tmp en Vercel) o archivo local. */
export function dbMode(): DbMode {
  if (remoteDbEnv()) return "turso";
  if (Boolean(process.env.VERCEL) && process.env.ALLOW_EPHEMERAL_DB === "true") return "ephemeral";
  return "local";
}

/**
 * Modo demostración: en Vercel sin Turso, con ALLOW_EPHEMERAL_DB=true se usa
 * un SQLite en /tmp que NO persiste entre despliegues ni instancias. Sirve
 * para revisar el sitio antes de conectar la base definitiva.
 */
export function isEphemeralDb(): boolean {
  return dbMode() === "ephemeral";
}

type Cache = { client?: Client; db?: Db; ready?: Promise<Db> };
const g = globalThis as unknown as { __donationDb?: Cache };
const cache: Cache = (g.__donationDb ??= {});

function resolveUrl(): { url: string; authToken?: string } {
  const remote = remoteDbEnv();
  if (remote) {
    console.info(`DONATION: base de datos remota (${remote.key}).`);
    return { url: remote.url, authToken: remote.authToken };
  }
  if (isEphemeralDb()) {
    console.warn("DONATION: base de datos temporal en /tmp (modo demostración). Conecta Turso para conservar los datos.");
    return { url: EPHEMERAL_URL };
  }
  if (process.env.VERCEL) {
    throw new Error(
      "DONATION: falta TURSO_DATABASE_URL (y TURSO_AUTH_TOKEN). En Vercel el sistema de archivos no persiste, " +
        "así que la base local SQLite no sirve: crea una base en Turso y configura las variables de entorno.",
    );
  }
  return { url: LOCAL_URL };
}

async function applyMigrations(client: Client) {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  );
  const applied = new Set(
    (await client.execute(`SELECT id FROM _migrations`)).rows.map((r) => String(r.id)),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    for (const statement of migration.statements) {
      await client.execute(statement);
    }
    await client.execute({ sql: `INSERT INTO _migrations (id) VALUES (?)`, args: [migration.id] });
  }
}

/**
 * Devuelve la conexión lista para usar: aplica migraciones pendientes y la
 * semilla inicial una sola vez por proceso.
 */
export function getDb(): Promise<Db> {
  if (cache.ready) return cache.ready;
  cache.ready = (async () => {
    const { url, authToken } = resolveUrl();
    const client = createClient({ url, authToken });
    await applyMigrations(client);
    const db = drizzle(client, { schema });
    await seedIfEmpty(db);
    await ensureBootstrapAdmin(db);
    await seedTasksIfEmpty(db);
    cache.client = client;
    cache.db = db;
    return db;
  })().catch((err) => {
    cache.ready = undefined; // permite reintentar en la siguiente petición
    throw err;
  });
  return cache.ready;
}

export { schema };
