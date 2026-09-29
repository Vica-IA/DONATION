# DONATO — guía para agentes

Lee `AGENTS.md` (reglas de Next.js 16) y `docs/10.00_MVP_TECNICO.md` antes de tocar código.

- Idioma de la interfaz y de los commits: español.
- Stack: Next.js 16 (App Router, Server Actions), Tailwind 4, Drizzle + libSQL (SQLite local / Turso en producción), zod.
- Cambios de esquema: agrega una migración nueva al final de `src/lib/db/migrations.ts` y actualiza `src/lib/db/schema.ts`. Nunca edites una migración ya aplicada.
- Toda acción de servidor del panel empieza con `await requireAdmin(...)` y valida con zod.
- Opciones de formularios viven solo en `src/lib/catalogs.ts`.
- Antes de subir: `npm run lint && npm run typecheck && npm run build`, y `npm run smoke` con un servidor limpio.
