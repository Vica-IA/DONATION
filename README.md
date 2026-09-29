# DONATION — De la donación al impacto

Plataforma de gestión, trazabilidad e impacto para misiones y ayuda humanitaria.
Esta es la **primera iteración operativa (MVP)**, enfocada en la Misión Levantar Chocó (9–12 de octubre de 2026): confirmar a los voluntarios de Grupo Kairós y Fundación Pálpitos y tener su logística lista.

## Qué hace hoy

- **Formulario público** para confirmar participación: `/misiones/choco-2026-01/confirmar` (pensado para celular).
- **Cupos y lista de espera** automáticos; sin registros duplicados (una persona = un documento).
- **Panel del equipo** en `/admin`: conteos, desglose por grupo/rol/logística, lista con filtros, ficha por persona, historial, CSV para Excel y enlace para compartir por WhatsApp.
- **Condiciones de participación**: el formulario incluye el consentimiento informado completo y solo se puede enviar aceptándolo con una única casilla (declaraciones, uso de imagen y datos personales). Queda registro de fecha, versión y texto aceptado. Si el documento cambia de versión, la persona vuelve a aceptarlo desde su enlace personal con la misma casilla. El documento se edita por misión desde el panel.
- **Aporte y requisitos de viaje**: seguimiento del aporte económico por persona, póliza de accidentes y contacto de emergencia completo.
- **Consola de coordinación**: centro de misión (fase, días a la salida, criterios Go / No-Go, avance por área, pendientes críticos), coordinación por áreas y tablero de tareas.
- **Finanzas por misión**: presupuesto de gastos (proyectado), compromisos y ejecución por categoría; ingresos por fuente (donaciones, patrocinios, recaudación) más los aportes de las personas voluntarias calculados desde sus fichas; balance actual y proyectado, faltante por recaudar, movimientos con filtros, edición y CSV. Registran el administrador y la coordinación de Financiero; líderes y coordinadores consultan.
- **Usuarios y roles**: cada persona del equipo entra con su correo y contraseña; cambia la suya en Mi cuenta y, si la olvida, un administrador le genera un enlace de un solo uso (48 horas) para crear una nueva, o le asigna una temporal. Roles: administrador (control total), líder de grupo (KAIROS, Fundación Pálpitos: gestiona su gente), coordinador de área (Logística, Transporte, Alimentación, Financiero, Espiritual, Emocional: gestiona las tareas de su área) y solo consulta.
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

## Despliegue actual

- Proyecto Vercel: `donation` (equipo `info-42989304s-projects`). URL de producción: <https://donation-psi-tawny.vercel.app>. Formulario público: <https://donation-psi-tawny.vercel.app/misiones/choco-2026-01/confirmar>. Panel: <https://donation-psi-tawny.vercel.app/admin>. El dominio anterior <https://donaton-lilac.vercel.app> sigue apuntando al mismo proyecto.
- Conectado al repositorio `Vica-IA/DONATION` con la integración de GitHub de Vercel: cada push a la rama `claude/stoic-mayer-8o32sp` (rama de producción del proyecto) despliega solo.
- Base de datos: Turso, conectado como store del Marketplace de Vercel (Storage → Connect Project en Production, Preview y Development; crea `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`). La app detecta la URL `libsql://` bajo cualquier nombre de variable; si no encuentra ninguna y `ALLOW_EPHEMERAL_DB=true`, cae al modo demostración (base temporal, formulario cerrado, aviso en el panel). El administrador ve en la barra lateral qué base usa el despliegue ("Base de datos: Turso / temporal / local").
- Protección de despliegues: la autenticación de Vercel aplica solo a previews; la URL de producción es pública para que las personas voluntarias puedan usar el formulario.

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
   | `ADMIN_PASSWORD_RESET` | solo para rescate: un texto nunca usado antes (p. ej. `2026-10-01-a`); ver abajo |

   Mientras no exista la base en Turso, puedes definir `ALLOW_EPHEMERAL_DB=true` para revisar el sitio con una base temporal (se reinicia sola y el formulario público queda cerrado). Quítala al conectar Turso.

4. **Deploy.** Al primer arranque la app crea las tablas, carga la misión inicial y el primer administrador. Entra a `/admin`, crea las cuentas del equipo en "Usuarios" (cada una recibe una contraseña temporal que debe cambiar al entrar; si alguien la olvida, genera desde su ficha un enlace para crear una nueva), revisa fechas, cupos y punto de encuentro, y comparte el enlace del formulario.

### Rescate del único administrador

Si la única cuenta de administrador pierde su contraseña, nadie puede generarle un enlace desde el panel. El rescate se hace desde Vercel:

1. En Settings → Environment Variables, pon en `ADMIN_PASSWORD` una contraseña temporal nueva y en `ADMIN_PASSWORD_RESET` un texto que no hayas usado antes (por ejemplo la fecha, `2026-10-01-a`).
2. Redespliega (Deployments → ⋯ → Redeploy): los cambios de variables solo aplican en un despliegue nuevo.
3. Entra con el correo de `ADMIN_EMAIL` y esa contraseña temporal. El panel obliga a cambiarla.

Cada valor de `ADMIN_PASSWORD_RESET` se aplica una sola vez (queda anotado en la base), así que la variable puede quedarse: no se repite en cada arranque ni cierra sesiones. La cuenta vuelve a ser administrador activo aunque la hubieran degradado o desactivado. El rescate queda en la bitácora de actividad.

## Roles del panel

| Rol | Puede |
|---|---|
| Administrador | Control total: misiones, participantes (incluido borrar inscripciones), tareas, finanzas, exportación y usuarios. |
| Líder de grupo | Gestionar los participantes de su grupo (estado, rol, notas, contacto, aporte), ver sus datos de salud, exportar su lista, crear y cerrar tareas propias. Consultar las finanzas. |
| Coordinador de área | Ver el equipo completo, gestionar las tareas de su área y consultar las finanzas. Solo el de Logística ve datos de salud (primeros auxilios); solo el de Financiero registra y edita movimientos financieros. |
| Solo consulta | Ver cupos, listas, fichas y tareas sin datos de salud, contacto de emergencia ni finanzas. No exporta ni edita. |

La matriz de permisos vive en `src/lib/permissions.ts`. Las contraseñas se guardan con scrypt; cambiar la contraseña cierra las demás sesiones de esa cuenta.

## Estructura

```text
src/app/                      rutas (App Router)
  page.tsx                    inicio público: convocatorias abiertas
  misiones/[slug]/confirmar   formulario público + acción de servidor
  misiones/[slug]/gracias     confirmación de envío
  misiones/[slug]/condiciones/[id]  aceptación por enlace personal cuando cambia la versión de las condiciones
  admin/m/[missionId]/        consola de una misión: resumen, voluntarios, tareas, áreas, finanzas, editar, CSV
  admin/(shell)/              páginas globales del panel: misiones, usuarios, mi cuenta
  admin/login                 acceso
src/lib/
  catalogs.ts                 opciones del formulario (roles, habilidades, estados...)
  validation.ts               esquemas zod
  data.ts                     consultas y reglas (cupos, duplicados, bitácora)
  auth*.ts                    sesión del panel (cookie firmada + usuario en base de datos)
  users.ts, password.ts       usuarios del panel y contraseñas (scrypt)
  permissions.ts              roles, alcances (grupo / área) y permisos
  tasks.ts                    tareas por misión y área
  finance.ts                  movimientos financieros: presupuesto, compromisos, ejecución, aportes y proyecciones
  mission-timeline.ts         fases y días a la salida de una misión
src/components/admin-shell.tsx  barra lateral y encabezados del panel
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
