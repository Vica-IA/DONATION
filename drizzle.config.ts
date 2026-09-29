import { defineConfig } from "drizzle-kit";

// Solo para herramientas de desarrollo (drizzle-kit studio / generate).
// Las migraciones que corre la app viven en src/lib/db/migrations.ts.
export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:./data/donato.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
