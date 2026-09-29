# DONATION — guía para agentes

Lee `AGENTS.md` (reglas de Next.js 16) y `docs/10.00_MVP_TECNICO.md` antes de tocar código.

- Idioma de la interfaz y de los commits: español.
- Stack: Next.js 16 (App Router, Server Actions), Tailwind 4, Drizzle + libSQL (SQLite local / Turso en producción), zod.
- Cambios de esquema: agrega una migración nueva al final de `src/lib/db/migrations.ts` y actualiza `src/lib/db/schema.ts`. Nunca edites una migración ya aplicada.
- Toda página y acción de servidor del panel empieza con `await requireUser(...)` o `await requirePermission("<permiso>", ...)` y comprueba el alcance con las funciones de `src/lib/permissions.ts` (`canManageRegistration`, `canSeeSensitive`, `canEditTask`, `participantScope`). Valida con zod. La interfaz solo esconde botones; la seguridad está en el servidor.
- Páginas del panel: dentro de `src/app/admin/m/[missionId]/` (por misión) o `src/app/admin/(shell)/` (globales). Usan `PageHeader` + `PageBody` de `src/components/admin-shell.tsx`. Colores solo con los tokens de `globals.css` (nada de `slate-*`).
- Opciones de formularios viven solo en `src/lib/catalogs.ts`.
- Antes de subir: `npm run lint && npm run typecheck && npm run build`, y `npm run smoke` con un servidor limpio.
