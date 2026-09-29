# DONATION — De la donación al impacto

Plataforma de gestión, trazabilidad e impacto para misiones y ayuda humanitaria.
Esta es la **primera iteración operativa (MVP)**, enfocada en la Misión Chocó 01 (9–12 de octubre de 2026): confirmar a los voluntarios de KAIROS Life y PALPITOS y tener su logística lista.

## Qué hace hoy

- **Formulario público** para confirmar participación: `/misiones/choco-2026-01/confirmar` (pensado para celular).
- **Cupos y lista de espera** automáticos; sin registros duplicados (una persona = un documento).
- **Panel del equipo** en `/admin`: conteos, desglose por grupo/rol/logística, lista con filtros, ficha por persona, historial, CSV para Excel y enlace para compartir por WhatsApp.
- **Condiciones de participación**: tras confirmar, cada persona lee el consentimiento informado de la misión, marca las casillas, indica si autoriza el uso de su imagen y firma. Queda registro de fecha, versión y texto aceptado. El documento se edita por misión desde el panel.
- **Aporte y requisitos de viaje**: seguimiento del aporte económico por persona, vacuna de fiebre amarilla, póliza de accidentes y contacto de emergencia completo.
- **Usuarios y roles**: cada persona del equipo entra con su correo y contraseña. Roles: administrador (todo), coordinador de misión (gestiona participantes, ve datos de salud, exporta) y solo consulta (lectura sin datos sensibles).
- **Varias misiones**: crea y edita misiones desde el panel.

La documentación del proyecto está en [`docs/`](docs/), incluido el detalle técnico de esta iteración en [`docs/10.00_MVP_TECNICO.md`](docs/10.00_MVP_TECNICO.md).

## Correr en local

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. En desarrollo la base de datos es un archivo SQLite (`data/donation.db`) que se crea solo, con la misión y los grupos ya cargados.
El primer administrador también se crea solo: en desarrollo es `admin@donation.local` / `donation2026` (o lo que pongas en `ADMIN_EMAIL` y `ADMIN_PASSWORD` dentro de `.env.local`). Desde `/admin/usuarios` creas al resto del equipo.

Otros comandos:

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run build       # build de producción
npm run smoke       # prueba de extremo a extremo (necesita el servidor corriendo, ver abajo)
npm run db:studio   # explorador de la base de datos (Drizzle Studio)
```

Prueba de extremo a extremo (usa Chromium vía Playwright; `npm start` corre en modo producción, por eso necesita `AUTH_SECRET`):

```bash
npm run build
rm -f data/donation.db && AUTH_SECRET=secreto-de-prueba ADMIN_EMAIL=admin@prueba.local ADMIN_PASSWORD=clave-prueba PORT=3100 npm start &
BASE_URL=http://localhost:3100 ADMIN_EMAIL=admin@prueba.local ADMIN_PASSWORD=clave-prueba npm run smoke
```

## Desplegar en Vercel (producción)

1. **Base de datos.** En Vercel el sistema de archivos no persiste, así que se usa [Turso](https://turso.tech) (libSQL gestionado, capa gratuita). Crea una base y copia su URL y token. También puedes instalarlo desde el Marketplace de Vercel (Storage → Turso), que crea las variables por ti.
2. **Proyecto.** Importa este repositorio en Vercel (framework: Next.js, sin configuración extra).
3. **Variables de entorno** (Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `ADMIN_EMAIL` | correo del primer administrador (se crea en el primer arranque) |
   | `ADMIN_PASSWORD` | su contraseña inicial (cámbiala luego desde "Mi cuenta") |
   | `AUTH_SECRET` | cadena aleatoria de 32+ caracteres (obligatoria; `openssl rand -base64 32`) |
   | `TURSO_DATABASE_URL` | `libsql://...turso.io` |
   | `TURSO_AUTH_TOKEN` | token de Turso |
   | `NEXT_PUBLIC_SITE_URL` | URL pública, p. ej. `https://donation.vercel.app` (para el enlace que se comparte) |

4. **Deploy.** Al primer arranque la app crea las tablas, carga la misión inicial y el primer administrador. Entra a `/admin`, crea las cuentas del equipo en "Usuarios" (cada una recibe una contraseña temporal que debe cambiar al entrar), revisa fechas, cupos y punto de encuentro, y comparte el enlace del formulario.

## Roles del panel

| Rol | Puede |
|---|---|
| Administrador | Todo: misiones, participantes, exportación y usuarios. |
| Coordinador de misión | Gestionar participantes (estado, rol, notas, contacto), ver salud y contacto de emergencia, exportar CSV. |
| Solo consulta | Ver cupos, listas y fichas sin datos de salud ni contacto de emergencia. No exporta ni edita. |

La matriz de permisos vive en `src/lib/permissions.ts`. Las contraseñas se guardan con scrypt; cambiar la contraseña cierra las demás sesiones de esa cuenta.

## Estructura

```text
src/app/                      rutas (App Router)
  page.tsx                    inicio público: convocatorias abiertas
  misiones/[slug]/confirmar   formulario público + acción de servidor
  misiones/[slug]/gracias     confirmación de envío (enlaza al paso 2)
  misiones/[slug]/condiciones/[id]  lectura y aceptación de las condiciones de participación
  admin/                      panel (login, dashboard, misiones, participantes, CSV, usuarios, mi cuenta)
src/lib/
  catalogs.ts                 opciones del formulario (roles, habilidades, estados...)
  validation.ts               esquemas zod
  data.ts                     consultas y reglas (cupos, duplicados, bitácora)
  auth*.ts                    sesión del panel (cookie firmada + usuario en base de datos)
  users.ts, password.ts       usuarios del panel y contraseñas (scrypt)
  permissions.ts              roles y permisos
  db/                         esquema Drizzle, migraciones SQL y semilla
  terms/                      texto inicial de las condiciones de participación (semilla)
src/proxy.ts                  protege /admin antes de llegar a las páginas
scripts/smoke.ts              prueba de extremo a extremo con Playwright
docs/                         documentos del proyecto (índice en docs/README.md)
```

## Principios que respeta este MVP

- **Pequeño, rápido y operacional** (00.00 §20): solo lo necesario para la primera misión.
- **Trazabilidad** (00.00 §4.2): cada inscripción y cada cambio del equipo queda en la bitácora.
- **Datos sensibles protegidos** (00.00 §25): la información médica y de contacto solo se ve en el panel autenticado.
- **Escalable** (00.00 §26): organizaciones y misiones son entidades propias desde el inicio.
