# DONATION — Documentación del proyecto

Índice de los documentos del proyecto y registro de lo que se ha incorporado a la plataforma.

| Documento | Contenido | Estado |
|---|---|---|
| [00.00 Project Governance](00.00_PROJECT_GOVERNANCE.md) | Identidad, visión, principios, modelo de intervención, roadmap estratégico. | v0.1 · base de definición |
| [00.01 Executive Summary](00.01_EXECUTIVE_SUMMARY.md) | Resumen ejecutivo: problema, oportunidad, MVP, gobernanza. | v0.1 · base estratégica |
| [08.00 Misión Levantar Chocó Master Plan](08.00_MISION_CHOCO_MASTER_PLAN.md) | Plan maestro de la primera misión: fechas críticas, familia, vivienda, presupuesto, riesgos, GO/NO-GO. | v0.1 · plan de ejecución |
| [09.01 Consentimiento informado · Misión Kairós Etapa 2](09.01_CONSENTIMIENTO_INFORMADO_MISION_KAIROS_ETAPA2.md) | Condiciones de participación para voluntarios (requisitos, riesgos, deberes, conducta, logística, datos, responsabilidad). | Sujeto a revisión jurídica antes de cada misión |
| [10.00 MVP técnico](10.00_MVP_TECNICO.md) | Qué hace la plataforma hoy, arquitectura, modelo de datos, roles, siguientes pasos. | Se actualiza con cada entrega |
| Prototipo "Misión Chocó · Coordinación" (archivo de diseño) | Referencia visual y funcional de la consola: resumen, itinerario, áreas, voluntarios, tareas y app del voluntario. | Implementado: consola, resumen, áreas y tareas. Pendiente: itinerario, transporte, finanzas, cuadrillas, app del voluntario |

## Cómo se usa cada documento en la plataforma

- **09.01 Consentimiento informado** → es el texto que cada persona confirmada debe leer y aceptar en la plataforma (Paso 2 tras el formulario). La copia inicial que carga la app está en `src/lib/terms/kairos-etapa2.ts` (sin el anexo de control de cambios y con la *Declaración final de aceptación*). Después de cargada, el texto, las casillas y la versión se editan desde el panel: **Misiones → Editar → Condiciones de participación**. Si el texto cambia de fondo, sube la versión para que todos lo acepten de nuevo.
- **08.00 Master Plan** → alimenta la misión inicial (fechas 9–12 de octubre de 2026, territorios) y la lista de requisitos GO/NO-GO que el panel ayuda a verificar (confirmados, condiciones aceptadas, aporte pagado, vacuna, póliza, contacto de emergencia).

## Registro de actualizaciones

| Fecha | Cambio |
|---|---|
| 2026-09-29 | Se crean los documentos 00.00, 00.01 y 08.00. Se construye el MVP: formulario de confirmación, panel, cupos y lista de espera. |
| 2026-09-29 | Nombre del proyecto corregido a DONATION. |
| 2026-09-29 | Usuarios del panel con contraseña propia y tres roles (administrador, coordinador, consulta). |
| 2026-09-29 | Se incorpora el documento 09.01 y el flujo de aceptación de condiciones de participación; seguimiento del aporte económico; campos de vacuna, póliza y contacto de emergencia ampliado. |
| 2026-09-29 | Nuevo diseño del panel según el prototipo "Misión Chocó · Coordinación": consola con barra lateral, centro de misión, coordinación por áreas y tablero de tareas. Roles con alcance: administrador, líder de grupo (KAIROS, Fundación Pálpitos) y coordinador de área (Logística, Transporte, Alimentación, Financiero, Espiritual, Emocional). |
| 2026-09-29 | Producción en Vercel: proyecto `donation` conectado a GitHub (cada push a la rama de trabajo despliega solo) con base de datos Turso, en <https://donation-psi-tawny.vercel.app>; la autenticación de Vercel queda solo para previews para que el formulario sea público. |
| 2026-09-29 | La primera misión pasa a llamarse *Misión Levantar Chocó* (antes "Misión Chocó 01"); las bases ya creadas se renombran solas al arrancar si nadie editó el nombre. |

## Puntos por resolver entre documentos

Diferencias detectadas entre los documentos que conviene cerrar antes de la misión (la plataforma no las decide; se ajustan desde el panel):

1. **Nombre de los grupos.** Resuelto el 2026-09-29: los nombres oficiales son *Grupo Kairós* y *Fundación Pálpitos*. La plataforma y los documentos usan esos nombres.
2. **Territorios.** 08.00 menciona Quibdó, Tadó, Ánimas y Puerto Meluk; 09.01 menciona Tadó, Istmina y comunidades cercanas a Puerto Meluk. La misión cargada usa la lista de 09.01 como "por confirmar".
3. **Tamaño del equipo.** 00.00 y 08.00 estiman 10 voluntarios; la convocatoria actual es de 40 cupos.
4. **Cupo y pago.** 09.01 (cláusula 30) establece que el cupo se separa únicamente con el pago del aporte (~$400.000 COP). La plataforma confirma el cupo al inscribirse y deja el aporte como requisito que el equipo marca a mano; si se prefiere, el estado puede cambiarse a "pendiente" hasta recibir el pago.
5. **Admisión.** 09.01 (cláusula 5b) restringe la convocatoria a integrantes activos del Grupo Kairós; el formulario permite indicar "otro grupo".
