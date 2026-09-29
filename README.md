# DONATION — De la donación al impacto

Plataforma de gestión, trazabilidad e impacto para misiones y ayuda humanitaria.
Esta es la **primera iteración operativa (MVP)**, enfocada en la Misión Chocó 01 (9–12 de octubre de 2026): confirmar a los voluntarios de KAIROS Life y PALPITOS y tener su logística lista.

## Qué hace hoy

- **Formulario público** para confirmar participación: `/misiones/choco-2026-01/confirmar` (pensado para celular).
- **Cupos y lista de espera** automáticos; sin registros duplicados (una persona = un documento).
- **Panel del equipo** en `/admin`: conteos, desglose por grupo/rol/logística, lista con filtros, ficha por persona, historial, CSV para Excel y enlace para compartir por WhatsApp.
- **Varias misiones**: crea y edita misiones desde el panel.

La documentación del proyecto está en [`docs/`](docs/), incluido el detalle técnico de esta iteración en [`docs/10.00_MVP_TECNICO.md`](docs/10.00_MVP_TECNICO.md).

## Correr en local

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. En desarrollo la base de datos es un archivo SQLite (`data/donation.db`) que se crea solo, con la misión y los grupos ya cargados.
La contraseña del panel en desarrollo es `donation2026` (o la que pongas en `ADMIN_PASSWORD` dentro de `.env.local`).

Otros comandos:

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run build       # build de producción
npm run smoke       # prueba de extremo a extremo (necesita el servidor corriendo, ver abajo)
npm run db:studio   # explorador de la base de datos (Drizzle Studio)
```

Prueba de extremo a extremo (usa Chromium vía Playwright):

```bash
rm -f data/donation.db && ADMIN_PASSWORD=clave-prueba PORT=3100 npm start &
BASE_URL=http://localhost:3100 ADMIN_PASSWORD=clave-prueba npm run smoke
```

## Desplegar en Vercel (producción)

1. **Base de datos.** En Vercel el sistema de archivos no persiste, así que se usa [Turso](https://turso.tech) (libSQL gestionado, capa gratuita). Crea una base y copia su URL y token. También puedes instalarlo desde el Marketplace de Vercel (Storage → Turso), que crea las variables por ti.
2. **Proyecto.** Importa este repositorio en Vercel (framework: Next.js, sin configuración extra).
3. **Variables de entorno** (Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `ADMIN_PASSWORD` | contraseña del panel (obligatoria) |
   | `AUTH_SECRET` | cadena aleatoria de 32+ caracteres (recomendada) |
   | `TURSO_DATABASE_URL` | `libsql://...turso.io` |
   | `TURSO_AUTH_TOKEN` | token de Turso |
   | `NEXT_PUBLIC_SITE_URL` | URL pública, p. ej. `https://donation.vercel.app` (para el enlace que se comparte) |

4. **Deploy.** Al primer arranque la app crea las tablas y carga la misión inicial. Entra a `/admin`, revisa fechas, cupos y punto de encuentro, y comparte el enlace del formulario.

## Estructura

```text
src/app/                      rutas (App Router)
  page.tsx                    inicio público: convocatorias abiertas
  misiones/[slug]/confirmar   formulario público + acción de servidor
  misiones/[slug]/gracias     confirmación de envío
  admin/                      panel (login, dashboard, misiones, participantes, CSV)
src/lib/
  catalogs.ts                 opciones del formulario (roles, habilidades, estados...)
  validation.ts               esquemas zod
  data.ts                     consultas y reglas (cupos, duplicados, bitácora)
  auth*.ts                    sesión del panel (cookie firmada)
  db/                         esquema Drizzle, migraciones SQL y semilla
src/proxy.ts                  protege /admin antes de llegar a las páginas
scripts/smoke.ts              prueba de extremo a extremo con Playwright
docs/                         documentos de gobierno y planes del proyecto
```

## Principios que respeta este MVP

- **Pequeño, rápido y operacional** (00.00 §20): solo lo necesario para la primera misión.
- **Trazabilidad** (00.00 §4.2): cada inscripción y cada cambio del equipo queda en la bitácora.
- **Datos sensibles protegidos** (00.00 §25): la información médica y de contacto solo se ve en el panel autenticado.
- **Escalable** (00.00 §26): organizaciones y misiones son entidades propias desde el inicio.
