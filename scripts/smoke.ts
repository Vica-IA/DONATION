/**
 * Prueba de humo de extremo a extremo (Playwright + Chromium).
 * Uso: BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/smoke.ts
 * Requiere un servidor corriendo con base de datos limpia (o al menos la misión semilla).
 */
import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@donation.local";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "donation2026";
const SLUG = "choco-2026-01";
const exe = process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

/** Texto visible (sin scripts ni carga RSC). */
const body = async (page: Page) => (await page.innerText("body")) ?? "";

async function main() {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ locale: "es-CO", acceptDownloads: true, viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => (m.type() === "error" ? errors.push(m.text()) : null));

  // ---------- Público ----------
  await page.goto(`${BASE}/`);
  await page.getByRole("link", { name: "Confirmar participación" }).first().click();
  await page.waitForURL(`**/misiones/${SLUG}/confirmar`);
  assert.doesNotMatch(await body(page), /cupos confirmados/); // los cupos solo se ven en el panel
  assert.match(await body(page), /Salida:\s*Viernes 9 de octubre, 6:00 p\. m\. · Llegada:\s*Lunes 12 de octubre, 11:00 p\. m\./);
  assert.doesNotMatch(await body(page), /Primera misión de campo/);
  assert.equal(await page.locator('img[alt^="Kairós Life"]').count(), 1, "portada de Kairós en el formulario");
  assert.ok((await page.locator('img[alt="Grupo Kairós"]').count()) >= 1, "logo de Kairós en el registro");
  assert.match(await body(page), /Aporte por persona:\s*\$\s?400\.000/);
  console.log("✓ landing → formulario");

  await page.getByRole("button", { name: "Enviar mi respuesta" }).click();
  await page.getByText("Revisa los campos marcados en rojo.").waitFor();
  assert.ok(await page.getByText("Indica si confirmas tu participación").isVisible());
  assert.ok(await page.getByText("Escribe tu nombre completo").isVisible());
  assert.ok(await page.getByText("Elige tu grupo").isVisible());
  assert.ok(await page.getByText("Debes aceptar las condiciones de participación").isVisible());
  assert.match(await body(page), /CONSENTIMIENTO INFORMADO Y CONDICIONES DE PARTICIPACIÓN/);
  assert.equal(await page.locator("#shirtSize").count(), 0);
  assert.equal(await page.locator("#refugio").count(), 0);
  // Grupo Kairós muestra el refugio y lo exige
  const kairosOpts = await page.$$eval("#organizationId option", (o) => o.map((x) => ({ v: (x as HTMLOptionElement).value, t: x.textContent })));
  assert.ok(!kairosOpts.some((o) => /otro/i.test(o.t ?? "")), "el formulario ya no ofrece 'otro grupo'");
  await page.selectOption("#organizationId", kairosOpts.find((o) => o.t?.includes("Kairós"))!.v);
  await page.locator("#refugio").waitFor();
  await page.selectOption("#organizationId", kairosOpts.find((o) => o.t?.includes("Pálpitos"))!.v);
  assert.equal(await page.locator("#refugio").count(), 0);
  console.log("✓ validación de campos requeridos; refugio solo con Grupo Kairós");

  const fill = async (p: { name: string; doc: string; attendance: string; phone: string; org?: string; refugio?: string }) => {
    await page.goto(`${BASE}/misiones/${SLUG}/confirmar`);
    await page.getByLabel(new RegExp(`^${p.attendance}`)).check();
    await page.selectOption("#preferredRole", "logistica");
    await page.fill("#fullName", p.name);
    await page.selectOption("#docType", "CC");
    await page.fill("#docNumber", p.doc);
    await page.fill("#birthDate", "1990-05-20");
    await page.fill("#city", "Medellín");
    await page.fill("#phone", p.phone);
    await page.fill("#email", `${p.doc}@ejemplo.com`);
    const orgOptions = await page.$$eval("#organizationId option", (o) => o.map((x) => ({ v: (x as HTMLOptionElement).value, t: x.textContent })));
    const org = orgOptions.find((o) => o.t?.includes(p.org ?? "Kairós"));
    assert.ok(org, "el grupo debe existir en el select");
    await page.selectOption("#organizationId", org!.v);
    if (org!.t?.includes("Kairós")) {
      if (p.refugio !== "") await page.fill("#refugio", p.refugio ?? "Refugio San José");
    } else {
      assert.equal(await page.locator("#refugio").count(), 0);
    }
    await page.fill("#eps", "Sura");
    await page.selectOption("#bloodType", "O+");
    await page.fill("#emergencyContactName", "Ana Pérez");
    await page.fill("#emergencyContactPhone", "3001112233");
    await page.fill("#emergencyContactRelationship", "Madre");
    await page.fill("#emergencyContactPhone2", "3009998877");
    await page.fill("#accidentInsurance", "Sura · póliza 12345");
    await page.fill("#dietaryNotes", "Sin gluten");
    await page.getByLabel("Carpintería").check();
    await page.getByLabel("Primeros auxilios").check();
    await page.getByLabel("Tengo experiencia en obra").check();
    await page.fill("#comments", "Prueba automática");
    await page.getByLabel(/He leído y acepto/).check();
    await page.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await page.waitForURL(`**/misiones/${SLUG}/gracias**`);
    return new URL(page.url());
  };

  // Kairós sin refugio: rechazado
  await page.goto(`${BASE}/misiones/${SLUG}/confirmar`);
  await page.getByLabel(/^Sí, confirmo/).check();
  await page.selectOption("#preferredRole", "logistica");
  await page.fill("#fullName", "Sin Refugio Prueba");
  await page.selectOption("#docType", "CC");
  await page.fill("#docNumber", "1000000009");
  await page.fill("#phone", "3001000009");
  await page.selectOption("#organizationId", kairosOpts.find((o) => o.t?.includes("Kairós"))!.v);
  await page.fill("#emergencyContactName", "Ana Pérez");
  await page.fill("#emergencyContactPhone", "3001112233");
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByRole("button", { name: "Enviar mi respuesta" }).click();
  await page.getByText("Indica tu refugio").waitFor();
  assert.match(page.url(), /\/confirmar$/);

  let url = await fill({ name: "Juan Prueba Uno", doc: "1000000001", attendance: "Sí, confirmo", phone: "3001000001" });
  assert.equal(url.searchParams.get("estado"), "confirmado");
  assert.match((await page.textContent("h1")) ?? "", /Juan: ¡Tu reserva está confirmada!/);
  const registrationId = url.searchParams.get("r");
  assert.ok(registrationId, "la página de gracias recibe el id de inscripción");
  console.log("✓ inscripción confirmada");

  // Condiciones aceptadas en el mismo formulario: evidencia y 404
  assert.match(await body(page), /Ya aceptaste las condiciones de participación/);
  assert.equal(await page.getByRole("link", { name: "Leer y aceptar las condiciones" }).count(), 0);
  await page.goto(`${BASE}/misiones/${SLUG}/condiciones/${registrationId}`);
  let termsBody = await body(page);
  assert.match(termsBody, /Ya aceptaste estas condiciones/);
  assert.match(termsBody, /Autorizaste el uso de tu imagen/);
  const bad = await page.goto(`${BASE}/misiones/${SLUG}/condiciones/00000000-0000-0000-0000-000000000000`);
  assert.equal(bad?.status(), 404);
  console.log("✓ condiciones aceptadas desde el formulario: evidencia y 404");

  url = await fill({ name: "María Prueba Dos", doc: "1000000002", attendance: "Todavía no estoy", phone: "3001000002", org: "Pálpitos" });
  assert.equal(url.searchParams.get("estado"), "pendiente");
  const mariaRegistrationId = url.searchParams.get("r")!;
  console.log("✓ inscripción pendiente (Fundación Pálpitos)");

  url = await fill({ name: "Juan Prueba Uno", doc: "1.000.000.001", attendance: "Sí, confirmo", phone: "3001000009" });
  assert.equal(url.searchParams.get("actualizado"), "1");
  assert.equal(url.searchParams.get("estado"), "confirmado");
  console.log("✓ reenvío con el mismo documento actualiza el registro");

  // ---------- Panel: login ----------
  const loginAs = async (email: string, password: string) => {
    await page.goto(`${BASE}/admin/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Entrar" }).click();
  };
  const logoutNow = async () => {
    await page.goto(`${BASE}/admin/cuenta`);
    await page.getByRole("button", { name: "Salir" }).click();
    await page.waitForURL("**/admin/login**");
  };
  const changePassword = async (current: string, next: string) => {
    await page.waitForURL("**/admin/cuenta?obligatorio=1");
    await page.fill("#currentPassword", current);
    await page.fill("#newPassword", next);
    await page.fill("#confirmPassword", next);
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    // /admin?cuenta=ok redirige a la misión activa: esperar la URL final.
    await page.waitForURL(/\/admin\/m\/[^/?]+\?cuenta=ok$/);
  };

  await page.goto(`${BASE}/admin`);
  await page.waitForURL("**/admin/login**");
  await loginAs(ADMIN_EMAIL, "incorrecta");
  await page.getByText("Correo o contraseña incorrectos.").waitFor();
  await loginAs(ADMIN_EMAIL, PASSWORD);
  await page.waitForURL(/\/admin\/m\/[^/?]+$/);
  const missionId = new URL(page.url()).pathname.split("/")[3];
  const base = `${BASE}/admin/m/${missionId}`;
  let dash = await body(page);
  assert.match(dash, /Centro de misión/);
  assert.match(dash, /Misión Levantar Chocó/);
  assert.match(dash, /Grupo Kairós 1\/1/);
  assert.match(dash, /Fundación Pálpitos 0\/1/);
  assert.match(dash, /Administrador/);
  assert.match(dash, /criterios Go listos/);
  assert.match(dash, /0\/16/);
  assert.match(dash, /Sin coordinador asignado/);
  console.log("✓ login y centro de misión (conteos, fases, criterios Go/No-Go)");

  // Mi cuenta: cambio voluntario de contraseña y reingreso con la nueva
  const ADMIN_NEW = `${PASSWORD}-nueva`;
  await page.goto(`${BASE}/admin/cuenta`);
  await page.fill("#currentPassword", "equivocada-123");
  await page.fill("#newPassword", ADMIN_NEW);
  await page.fill("#confirmPassword", ADMIN_NEW);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await page.getByText("La contraseña actual no es correcta.").waitFor();
  await page.fill("#currentPassword", PASSWORD);
  await page.fill("#newPassword", ADMIN_NEW);
  await page.fill("#confirmPassword", ADMIN_NEW);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await page.waitForURL(/\/admin\/m\/[^/?]+\?cuenta=ok$/);
  assert.match(await body(page), /Contraseña actualizada/);
  await logoutNow();
  await loginAs(ADMIN_EMAIL, PASSWORD);
  await page.getByText("Correo o contraseña incorrectos.").waitFor();
  await loginAs(ADMIN_EMAIL, ADMIN_NEW);
  await page.waitForURL(/\/admin\/m\/[^/?]+$/);
  dash = await body(page);
  console.log("✓ mi cuenta: cambio de contraseña, la anterior deja de servir, reingreso con la nueva");

  // Go/No-Go: marcar el primer criterio
  await page.getByRole("button", { name: "Marcar hecha" }).first().click();
  await page.waitForTimeout(500);
  dash = await body(page);
  assert.match(dash, /1\/16/);
  console.log("✓ criterio Go/No-Go marcado desde el resumen");

  // Tablero de tareas: crear y avanzar
  await page.goto(`${base}/tareas?nueva=1`);
  await page.fill("#title", "Tarea de prueba admin");
  await page.selectOption("#area", "transporte");
  await page.fill("#dueDate", "2026-10-03");
  await page.getByRole("button", { name: "Crear tarea" }).click();
  await page.getByText("Tarea creada.").waitFor();
  await page.locator('[data-title="Tarea de prueba admin"] form button').first().click();
  await page.waitForTimeout(500);
  await page.locator('[data-title="Tarea de prueba admin"] form button', { hasText: "Marcar hecha" }).waitFor();
  await page.getByRole("link", { name: "Tarea de prueba admin" }).click();
  await page.waitForURL("**/tareas/**");
  assert.match(await body(page), /En curso/);
  await page.getByRole("button", { name: "Eliminar tarea" }).click();
  await page.waitForURL(`${base}/tareas`);
  assert.doesNotMatch(await body(page), /Tarea de prueba admin/);
  console.log("✓ tablero: crear, avanzar, editar y eliminar tarea");

  // Finanzas: presupuesto, ingreso, edición, eliminación y CSV
  await page.goto(`${base}/finanzas?nuevo=1`);
  await page.locator('input[name="kind"][value="gasto"]').check();
  await page.selectOption("#category", "transporte");
  await page.selectOption("#status", "proyectado");
  await page.fill("#amount", "3.000.000");
  await page.fill("#concept", "Bus Medellín – Tadó (ida y regreso)");
  await page.fill("#entryDate", "2026-10-09");
  await page.selectOption("#area", "transporte");
  await page.getByRole("button", { name: "Registrar movimiento" }).click();
  await page.locator('[data-concept="Bus Medellín – Tadó (ida y regreso)"]').waitFor();
  let fin = await body(page);
  assert.match(fin, /Movimiento registrado\./);
  assert.match(fin, /Presupuesto de gastos\s*\$\s?3\.000\.000/i);
  assert.match(fin, /Transporte y fletes/);
  await page.locator('input[name="kind"][value="ingreso"]').check();
  await page.selectOption("#category", "donaciones");
  await page.selectOption("#status", "ejecutado");
  await page.fill("#amount", "1000000");
  await page.fill("#concept", "Donación parroquia");
  await page.getByRole("button", { name: "Registrar movimiento" }).click();
  await page.locator('[data-concept="Donación parroquia"]').waitFor();
  fin = await body(page);
  assert.match(fin, /Ingresos recibidos\s*\$\s?1\.000\.000/i);
  assert.match(fin, /Donaciones/);
  await page.getByRole("link", { name: "Bus Medellín – Tadó (ida y regreso)" }).click();
  await page.waitForURL("**/finanzas/**");
  await page.fill("#amount", "3.500.000");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByText("Cambios guardados.").waitFor();
  await page.goto(`${base}/finanzas`);
  fin = await body(page);
  assert.match(fin, /Presupuesto de gastos\s*\$\s?3\.500\.000/i);
  await page.goto(`${base}/finanzas?tipo=ingreso`);
  assert.match(await body(page), /1 de 2/);
  await page.getByRole("link", { name: "Donación parroquia" }).click();
  await page.waitForURL("**/finanzas/**");
  await page.getByRole("button", { name: "Eliminar movimiento" }).click();
  await page.waitForURL(`${base}/finanzas`);
  assert.doesNotMatch(await body(page), /Donación parroquia/);
  const finCsv = await page.request.get(`${base}/finanzas/export`);
  assert.equal(finCsv.status(), 200);
  assert.match(await finCsv.text(), /Bus Medellín/);
  console.log("✓ finanzas: presupuesto, ingreso, edición, filtro, eliminación y CSV");

  // Voluntarios: lista, filtro, gestión
  await page.goto(`${base}/voluntarios`);
  assert.match(await body(page), /2 registros en esta vista/);
  await page.fill('input[name="q"]', "María");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await page.waitForURL("**q=Mar%C3%ADa**");
  assert.match(await body(page), /1 registro en esta vista/);
  await page.getByRole("link", { name: "Gestionar" }).first().click();
  await page.waitForURL("**/voluntarios/**");
  await page.selectOption("#status", "confirmado");
  await page.selectOption("#assignedRole", "logistica");
  await page.fill("#adminNotes", "Nota interna de prueba");
  await page.selectOption("#paymentStatus", "pagado");
  await page.fill("#paymentAmount", "400000");
  await page.fill("#paymentNotes", "Transferencia de prueba");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Cambios guardados.").waitFor();
  await page.reload();
  let detail = await body(page);
  assert.match(detail, /estado pendiente → confirmado/);
  assert.match(detail, /aporte pendiente → pagado/);
  assert.match(detail, /Aceptadas el .* \(versión 1\)/);
  console.log("✓ gestión de participante (estado, rol, notas, aporte, historial)");

  await page.goto(`${base}/voluntarios/${registrationId}`);
  detail = await body(page);
  assert.match(detail, /Aceptadas el .* \(versión 1\)/);
  assert.match(detail, /Sura · póliza 12345/);
  await page.goto(`${base}/voluntarios`);
  assert.match(await body(page), /condiciones 2\/2/);
  // Área Logística: equipo asignado (Juan y María tienen rol logística)
  await page.goto(`${base}/areas/logistica`);
  const areaBody = await body(page);
  assert.match(areaBody, /Coordinación de Logística/);
  assert.match(areaBody, /Juan Prueba Uno/);
  assert.match(areaBody, /María Prueba Dos/);
  console.log("✓ voluntarios: filtros, condiciones, equipo por área");

  // Rutas antiguas redirigen
  await page.goto(`${BASE}/admin/participantes/${registrationId}`);
  await page.waitForURL(`${base}/voluntarios/${registrationId}`);
  await page.goto(`${BASE}/admin/misiones/${missionId}`);
  await page.waitForURL(`${base}/voluntarios`);
  console.log("✓ rutas antiguas redirigen");

  // CSV
  await page.goto(`${base}/voluntarios`);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Descargar CSV" }).first().click()]);
  const csv = fs.readFileSync((await download.path())!, "utf8");
  assert.ok(csv.charCodeAt(0) === 0xfeff, "CSV debe iniciar con BOM para Excel");
  const lines = csv.slice(1).trim().split(/\r?\n/);
  assert.equal(lines.length, 3, "CSV: encabezado + 2 filas");
  assert.match(lines[0], /^Estado;Nombre completo;/);
  assert.match(lines[0], /Condiciones aceptadas el;Autoriza imagen/);
  assert.match(csv, /Juan Prueba Uno/);
  assert.match(lines[0], /Grupo;Refugio;EPS/);
  assert.match(csv, /Refugio San José/);
  console.log("✓ exportación CSV");

  // Editar misión: cupos 2 y versión 2 de condiciones
  await page.goto(`${base}/editar`);
  await page.fill("#capacity", "2");
  await page.fill("#termsVersion", "2");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.waitForURL(/\/admin\/m\/[^/?]+$/);
  await page.goto(`${base}/voluntarios/${registrationId}`);
  assert.match(await body(page), /Pendientes \(versión vigente 2\)/);
  // Versión nueva: todos quedan pendientes; Juan vuelve a aceptar con una sola casilla
  await page.goto(`${base}/voluntarios`);
  assert.match(await body(page), /condiciones 0\/2/);
  await page.selectOption('select[name="requisito"]', "condiciones");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await page.waitForURL("**requisito=condiciones**");
  assert.match(await body(page), /María Prueba Dos/);
  assert.match(await body(page), /Juan Prueba Uno/);
  await page.goto(`${BASE}/misiones/${SLUG}/condiciones/${registrationId}`);
  termsBody = await body(page);
  assert.match(termsBody, /CONSENTIMIENTO INFORMADO Y CONDICIONES DE PARTICIPACIÓN/);
  assert.match(termsBody, /DECLARACIÓN FINAL DE ACEPTACIÓN/);
  assert.equal(await page.locator('input[name="declarations"]').count(), 0);
  await page.getByRole("button", { name: "Acepto las condiciones de participación" }).click();
  await page.getByText(/Debes marcar la casilla/).waitFor();
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByRole("button", { name: "Acepto las condiciones de participación" }).click();
  await page.waitForURL("**/condiciones/**?ok=1");
  assert.match(await body(page), /¡Gracias! Condiciones aceptadas/);
  await page.goto(`${base}/voluntarios?requisito=condiciones`);
  assert.match(await body(page), /María Prueba Dos/);
  assert.doesNotMatch(await body(page), /Juan Prueba Uno/);
  url = await fill({ name: "Pedro Prueba Tres", doc: "1000000003", attendance: "Sí, confirmo", phone: "3001000003" });
  assert.equal(url.searchParams.get("estado"), "lista_espera");
  console.log("✓ versión de condiciones y lista de espera al agotar cupos");

  // Borrar inscripción (solo administrador): un registro cancelado de prueba
  url = await fill({ name: "Borrar Prueba Cuatro", doc: "1000000004", attendance: "No podré asistir", phone: "3001000004", org: "Pálpitos" });
  assert.equal(url.searchParams.get("estado"), "cancelado");
  const deleteId = url.searchParams.get("r")!;
  await page.goto(`${base}/voluntarios/${deleteId}`);
  await page.getByRole("button", { name: "Eliminar inscripción" }).click(); // sin la casilla, el navegador no envía
  await page.waitForTimeout(300);
  assert.match(page.url(), new RegExp(`/voluntarios/${deleteId}$`));
  await page.getByLabel(/Entiendo que se borra/).check();
  await page.getByRole("button", { name: "Eliminar inscripción" }).click();
  await page.waitForURL("**/voluntarios?eliminada=**");
  assert.match(await body(page), /Inscripción de Borrar Prueba Cuatro eliminada/);
  await page.goto(`${base}/voluntarios`);
  assert.doesNotMatch(await body(page), /Borrar Prueba Cuatro/);
  const gone = await page.goto(`${base}/voluntarios/${deleteId}`);
  assert.equal(gone?.status(), 404);
  await page.goto(base);
  assert.match(await body(page), /Inscripción eliminada|eliminada/);
  console.log("✓ borrar inscripción: confirmación, lista, ficha 404 y bitácora");

  // ---------- Usuarios y roles ----------
  await page.goto(`${BASE}/admin/usuarios`);
  assert.match(await body(page), /Usuarios del panel/);

  // Coordinador de Logística
  await page.goto(`${BASE}/admin/usuarios/nuevo`);
  await page.fill("#name", "Carolina Coordinadora");
  await page.fill("#email", "coordinadora@prueba.local");
  await page.fill("#phone", "3005550001");
  await page.selectOption("#role", "coordinador");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Selecciona el área que coordina").waitFor();
  await page.selectOption("#area", "logistica");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Credenciales temporales").waitFor();
  const coordPassword = (await page.locator("code.font-bold").textContent())?.trim();
  assert.ok(coordPassword && coordPassword.length >= 8);
  // duplicado
  await page.goto(`${BASE}/admin/usuarios/nuevo`);
  await page.fill("#name", "Otra");
  await page.fill("#email", "coordinadora@prueba.local");
  await page.selectOption("#role", "consulta");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Ya existe un usuario con ese correo.").waitFor();
  // Líder de KAIROS
  await page.goto(`${BASE}/admin/usuarios/nuevo`);
  await page.fill("#name", "Lía Líder");
  await page.fill("#email", "lider@prueba.local");
  await page.selectOption("#role", "lider_grupo");
  const orgOpts = await page.$$eval("#organizationId option", (o) => o.map((x) => ({ v: (x as HTMLOptionElement).value, t: x.textContent })));
  await page.selectOption("#organizationId", orgOpts.find((o) => o.t?.includes("Kairós"))!.v);
  await page.fill("#password", "lider-2026-kairos");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Credenciales temporales").waitFor();
  // Consulta
  await page.goto(`${BASE}/admin/usuarios/nuevo`);
  await page.fill("#name", "Luis Lector");
  await page.fill("#email", "lector@prueba.local");
  await page.selectOption("#role", "consulta");
  await page.fill("#password", "lectura-2026");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Credenciales temporales").waitFor();
  await page.goto(`${BASE}/admin/usuarios`);
  const usersBody = await body(page);
  assert.match(usersBody, /Carolina Coordinadora/);
  assert.match(usersBody, /Logística/);
  assert.match(usersBody, /Lía Líder/);
  assert.match(usersBody, /Grupo Kairós/);
  assert.match(usersBody, /\(tú\)/);
  // El coordinador aparece en la barra lateral y en el área
  await page.goto(`${base}/areas/logistica`);
  assert.match(await body(page), /Carolina Coordinadora/);
  console.log("✓ usuarios: coordinador con área, líder con grupo, consulta, duplicado rechazado");

  // Enlace de nueva contraseña: el admin lo genera, la persona lo usa una sola vez
  await page.goto(`${BASE}/admin/usuarios/nuevo`);
  await page.fill("#name", "Enlace Prueba");
  await page.fill("#email", "enlace@prueba.local");
  await page.fill("#phone", "3005550009");
  await page.selectOption("#role", "consulta");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Credenciales temporales").waitFor();
  await page.goto(`${BASE}/admin/usuarios`);
  await page.getByRole("row", { name: /Enlace Prueba/ }).getByRole("link", { name: "Editar" }).click();
  await page.waitForURL("**/admin/usuarios/**");
  await page.getByRole("button", { name: "Generar enlace" }).click();
  await page.locator("#reset-link").waitFor();
  const resetLink = await page.inputValue("#reset-link");
  assert.match(resetLink, /\/admin\/restablecer\/[A-Za-z0-9_-]{20,}$/);
  assert.match(await body(page), /Enviar por WhatsApp/);
  // la ficha propia no permite restablecerse: remite a Mi cuenta
  await page.goto(`${BASE}/admin/usuarios`);
  await page.getByRole("row", { name: /\(tú\)/ }).getByRole("link", { name: "Editar" }).click();
  await page.waitForURL("**/admin/usuarios/**");
  assert.equal(await page.getByRole("button", { name: "Restablecer contraseña" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Generar enlace" }).count(), 0);
  assert.match(await body(page), /Ir a Mi cuenta/);
  await logoutNow();
  // la persona abre el enlace sin sesión (el servidor de prueba corre en otro puerto que siteUrl())
  const linkPath = new URL(resetLink).pathname;
  await page.goto(`${BASE}${linkPath}`);
  assert.match(await body(page), /Enlace Prueba/);
  await page.fill("#newPassword", "enlace-nueva-2026");
  await page.fill("#confirmPassword", "otra-distinta");
  await page.getByRole("button", { name: "Guardar contraseña y entrar" }).click();
  await page.getByText("Las contraseñas no coinciden").waitFor();
  await page.fill("#newPassword", "enlace-nueva-2026");
  await page.fill("#confirmPassword", "enlace-nueva-2026");
  await page.getByRole("button", { name: "Guardar contraseña y entrar" }).click();
  await page.waitForURL(/\/admin\/m\/[^/?]+\?cuenta=ok$/);
  assert.match(await body(page), /Enlace Prueba/);
  await logoutNow();
  await page.goto(`${BASE}${linkPath}`);
  assert.match(await body(page), /Este enlace ya no sirve/);
  await loginAs("enlace@prueba.local", "enlace-nueva-2026");
  await page.waitForURL(/\/admin\/m\/[^/?]+$/);
  await logoutNow();
  await loginAs(ADMIN_EMAIL, ADMIN_NEW);
  await page.waitForURL(/\/admin\/m\/[^/?]+$/);
  console.log("✓ enlace de nueva contraseña: generado, usado una sola vez, reingreso; ficha propia sin restablecer");

  // ---------- Coordinador ----------
  await logoutNow();
  await loginAs("coordinadora@prueba.local", coordPassword!);
  await changePassword(coordPassword!, "coordina-2026");
  let b = await body(page);
  assert.match(b, /Coordinador de área/);
  assert.equal(await page.getByRole("link", { name: "Usuarios" }).count(), 0);
  assert.equal(await page.getByRole("link", { name: "Editar misión" }).count(), 0);
  await page.goto(`${BASE}/admin/usuarios`);
  await page.waitForURL(/\/admin\/m\/[^/?]+\?denegado=1$/);
  assert.match(await body(page), /No tienes permiso/);
  await page.goto(`${BASE}/admin/misiones/nueva`);
  await page.waitForURL(/\/admin\/m\/[^/?]+\?denegado=1$/);
  // tareas de su área: crear y marcar
  await page.goto(`${base}/areas/logistica`);
  await page.fill("#title", "Tarea de Logística por coordinadora");
  await page.getByRole("button", { name: "Crear tarea" }).click();
  await page.getByText("Tarea creada.").waitFor();
  b = await body(page);
  assert.match(b, /Tarea de Logística por coordinadora/);
  assert.match(b, /Carolina Coordinadora/);
  // en el tablero solo puede avanzar tareas de su área (las de transporte no tienen botón)
  await page.goto(`${base}/tareas`);
  assert.ok((await page.locator('[data-title="Transporte confirmado"]').count()) > 0, "la tarea de transporte está en el tablero");
  assert.equal(await page.locator('[data-title="Transporte confirmado"] form button').count(), 0);
  assert.ok((await page.locator('[data-title="Tarea de Logística por coordinadora"] form button').count()) > 0);
  // finanzas: consulta pero no registra (no coordina Financiero)
  await page.goto(`${base}/finanzas`);
  b = await body(page);
  assert.match(b, /Presupuesto de gastos/i);
  assert.match(b, /Bus Medellín/);
  assert.equal(await page.getByRole("link", { name: "+ Nuevo movimiento" }).count(), 0);
  await page.getByRole("link", { name: "Bus Medellín – Tadó (ida y regreso)" }).click();
  await page.waitForURL("**/finanzas/**");
  assert.equal(await page.locator("#concept").count(), 0);
  assert.match(await body(page), /Solo el administrador y la coordinación de Financiero/);
  // voluntarios: ve datos de salud (Logística) pero no gestiona
  await page.goto(`${base}/voluntarios/${registrationId}`);
  b = await body(page);
  assert.match(b, /Ana Pérez/);
  assert.equal(await page.locator("#status").count(), 0);
  assert.match(b, /Tu rol no gestiona/);
  await logoutNow();
  await loginAs("coordinadora@prueba.local", coordPassword!);
  await page.getByText("Correo o contraseña incorrectos.").waitFor();
  console.log("✓ coordinador: cambio obligatorio de contraseña, tareas de su área, salud visible, sin gestión");

  // ---------- Líder de grupo (Grupo Kairós) ----------
  await loginAs("lider@prueba.local", "lider-2026-kairos");
  await changePassword("lider-2026-kairos", "lider-nueva-2026");
  b = await body(page);
  assert.match(b, /Líder de grupo/);
  await page.goto(`${base}/voluntarios`);
  b = await body(page);
  assert.match(b, /Ves únicamente las personas de tu grupo/);
  assert.match(b, /Juan Prueba Uno/);
  assert.match(b, /Pedro Prueba Tres/);
  assert.doesNotMatch(b, /María Prueba Dos/);
  const forbidden = await page.goto(`${base}/voluntarios/${mariaRegistrationId}`);
  assert.equal(forbidden?.status(), 404);
  await page.goto(`${base}/voluntarios/${registrationId}`);
  assert.ok(await page.locator("#status").isVisible());
  assert.match(await body(page), /Ana Pérez/);
  assert.equal(await page.getByRole("button", { name: "Eliminar inscripción" }).count(), 0); // borrar es solo del administrador
  const [leaderCsv] = await Promise.all([page.waitForEvent("download"), page.goto(`${base}/voluntarios`).then(() => page.getByRole("link", { name: "Descargar CSV" }).first().click())]);
  const leaderCsvText = fs.readFileSync((await leaderCsv.path())!, "utf8");
  assert.match(leaderCsvText, /Juan Prueba Uno/);
  assert.doesNotMatch(leaderCsvText, /María Prueba Dos/);
  await logoutNow();
  console.log("✓ líder de grupo: solo su grupo (lista, ficha, CSV), gestiona y ve salud");

  // ---------- Consulta ----------
  await loginAs("lector@prueba.local", "lectura-2026");
  await changePassword("lectura-2026", "lectura-nueva-2026");
  b = await body(page);
  assert.doesNotMatch(b, /Descargar CSV/);
  assert.equal(await page.getByRole("link", { name: "CSV", exact: true }).count(), 0);
  await page.goto(`${base}/tareas`);
  assert.equal(await page.getByRole("link", { name: "+ Nueva tarea" }).count(), 0);
  assert.equal(await page.locator("form button", { hasText: "Empezar" }).count(), 0);
  assert.equal(await page.getByRole("link", { name: "Finanzas" }).count(), 0);
  await page.goto(`${base}/finanzas`);
  await page.waitForURL(/\/admin\/m\/[^/?]+\?denegado=1$/);
  const finDenied = await page.request.get(`${base}/finanzas/export`);
  assert.equal(finDenied.status(), 403);
  await page.goto(`${base}/voluntarios`);
  b = await body(page);
  assert.doesNotMatch(b, /Descargar CSV/);
  await page.getByRole("link", { name: "Ver", exact: true }).first().click();
  await page.waitForURL("**/voluntarios/**");
  b = await body(page);
  assert.match(b, /Información reservada/);
  assert.doesNotMatch(b, /Ana Pérez/);
  assert.equal(await page.locator("#status").count(), 0);
  const exportResp = await page.request.get(`${base}/export`);
  assert.equal(exportResp.status(), 403);
  console.log("✓ consulta: solo lectura, sin salud, sin tareas ni exportación");

  await logoutNow();
  await page.goto(`${base}/export`);
  assert.match(page.url(), /\/admin\/login/); // el proxy redirige al login
  const anon = await page.request.get(`${base}/export`, { maxRedirects: 0 });
  assert.ok([307, 308, 401].includes(anon.status()), `sin sesión: ${anon.status()}`);
  console.log("✓ logout y protección de exportación");

  const realErrors = errors.filter((e) => !/404/.test(e));
  if (realErrors.length) console.warn("Errores de consola/página detectados:\n" + realErrors.join("\n"));
  await browser.close();
  console.log("\nTODO OK");
}

main().catch((e) => {
  console.error("✗ Smoke test falló:", e);
  process.exit(1);
});
