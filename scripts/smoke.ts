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
  assert.match(await body(page), /0 de 40 cupos confirmados/);
  assert.match(await body(page), /Aporte por persona:\s*\$\s?400\.000/);
  console.log("✓ landing → formulario");

  await page.getByRole("button", { name: "Enviar mi respuesta" }).click();
  await page.getByText("Revisa los campos marcados en rojo.").waitFor();
  assert.ok(await page.getByText("Indica si confirmas tu participación").isVisible());
  assert.ok(await page.getByText("Escribe tu nombre completo").isVisible());
  console.log("✓ validación de campos requeridos");

  const fill = async (p: { name: string; doc: string; attendance: string; phone: string; org?: string }) => {
    await page.goto(`${BASE}/misiones/${SLUG}/confirmar`);
    await page.getByLabel(new RegExp(`^${p.attendance}`)).check();
    await page.getByLabel("Todos los días de la misión").check();
    await page.getByLabel("Viajo con el grupo").check();
    await page.selectOption("#preferredRole", "logistica");
    await page.fill("#fullName", p.name);
    await page.selectOption("#docType", "CC");
    await page.fill("#docNumber", p.doc);
    await page.fill("#birthDate", "1990-05-20");
    await page.fill("#city", "Medellín");
    await page.fill("#phone", p.phone);
    await page.fill("#email", `${p.doc}@ejemplo.com`);
    const orgOptions = await page.$$eval("#organizationId option", (o) => o.map((x) => ({ v: (x as HTMLOptionElement).value, t: x.textContent })));
    const org = orgOptions.find((o) => o.t?.includes(p.org ?? "KAIROS"));
    assert.ok(org, "el grupo debe existir en el select");
    await page.selectOption("#organizationId", org!.v);
    await page.fill("#eps", "Sura");
    await page.selectOption("#bloodType", "O+");
    await page.fill("#emergencyContactName", "Ana Pérez");
    await page.fill("#emergencyContactPhone", "3001112233");
    await page.fill("#emergencyContactRelationship", "Madre");
    await page.fill("#emergencyContactPhone2", "3009998877");
    await page.fill("#yellowFeverVaccineDate", "2026-09-20");
    await page.fill("#accidentInsurance", "Sura · póliza 12345");
    await page.fill("#dietaryNotes", "Sin gluten");
    await page.getByLabel("Carpintería").check();
    await page.getByLabel("Primeros auxilios").check();
    await page.getByLabel("Tengo experiencia en obra").check();
    await page.selectOption("#shirtSize", "M");
    await page.fill("#comments", "Prueba automática");
    await page.getByLabel(/Autorizo el tratamiento/).check();
    await page.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await page.waitForURL(`**/misiones/${SLUG}/gracias**`);
    return new URL(page.url());
  };

  let url = await fill({ name: "Juan Prueba Uno", doc: "1000000001", attendance: "Sí, confirmo", phone: "3001000001" });
  assert.equal(url.searchParams.get("estado"), "confirmado");
  assert.match((await page.textContent("h1")) ?? "", /Juan: ¡Tu cupo está confirmado!/);
  const registrationId = url.searchParams.get("r");
  assert.ok(registrationId, "la página de gracias recibe el id de inscripción");
  console.log("✓ inscripción confirmada");

  // Paso 2: condiciones
  await page.getByRole("link", { name: "Leer y aceptar las condiciones" }).click();
  await page.waitForURL(`**/misiones/${SLUG}/condiciones/${registrationId}`);
  let termsBody = await body(page);
  assert.match(termsBody, /CONSENTIMIENTO INFORMADO Y CONDICIONES DE PARTICIPACIÓN/);
  assert.match(termsBody, /DECLARACIÓN FINAL DE ACEPTACIÓN/);
  assert.equal(await page.locator('input[name="declarations"]').count(), 17, "17 casillas de aceptación");
  await page.fill("#signedName", "Otro Nombre");
  await page.fill("#signedCity", "Medellín");
  await page.getByRole("button", { name: "Acepto las condiciones de participación" }).click();
  await page.getByText(/Debes marcar todas las casillas/).waitFor();
  assert.match(await body(page), /Indica si autorizas o no el uso de tu imagen/);
  assert.match(await body(page), /Escribe tu nombre exactamente como lo registraste/);
  for (let i = 0; i < 17; i++) await page.locator('input[name="declarations"]').nth(i).check();
  await page.getByLabel("SÍ autorizo").check();
  await page.fill("#signedName", "juan prueba uno");
  await page.fill("#signedCity", "Medellín");
  await page.getByRole("button", { name: "Acepto las condiciones de participación" }).click();
  await page.waitForURL("**/condiciones/**?ok=1");
  termsBody = await body(page);
  assert.match(termsBody, /¡Gracias! Condiciones aceptadas/);
  assert.match(termsBody, /Autorizaste el uso de tu imagen/);
  await page.goto(`${BASE}/misiones/${SLUG}/condiciones/${registrationId}`);
  assert.match(await body(page), /Ya aceptaste estas condiciones/);
  const bad = await page.goto(`${BASE}/misiones/${SLUG}/condiciones/00000000-0000-0000-0000-000000000000`);
  assert.equal(bad?.status(), 404);
  console.log("✓ condiciones de participación: validación, aceptación, evidencia y 404");

  url = await fill({ name: "María Prueba Dos", doc: "1000000002", attendance: "Todavía no estoy", phone: "3001000002", org: "PALPITOS" });
  assert.equal(url.searchParams.get("estado"), "pendiente");
  const mariaRegistrationId = url.searchParams.get("r")!;
  console.log("✓ inscripción pendiente (PALPITOS)");

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
  assert.match(dash, /Misión Chocó 01/);
  assert.match(dash, /KAIROS Life 1\/1/);
  assert.match(dash, /PALPITOS 0\/1/);
  assert.match(dash, /Administrador/);
  assert.match(dash, /criterios Go listos/);
  assert.match(dash, /0\/16/);
  assert.match(dash, /Sin coordinador asignado/);
  console.log("✓ login y centro de misión (conteos, fases, criterios Go/No-Go)");

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
  assert.match(detail, /Pendientes \(versión vigente 1\)/);
  console.log("✓ gestión de participante (estado, rol, notas, aporte, historial)");

  await page.goto(`${base}/voluntarios/${registrationId}`);
  detail = await body(page);
  assert.match(detail, /Aceptadas el .* \(versión 1\)/);
  assert.match(detail, /Sura · póliza 12345/);
  await page.goto(`${base}/voluntarios`);
  assert.match(await body(page), /condiciones 1\/2/);
  await page.selectOption('select[name="requisito"]', "condiciones");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await page.waitForURL("**requisito=condiciones**");
  assert.match(await body(page), /María Prueba Dos/);
  assert.doesNotMatch(await body(page), /Juan Prueba Uno/);
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
  console.log("✓ exportación CSV");

  // Editar misión: cupos 2 y versión 2 de condiciones
  await page.goto(`${base}/editar`);
  await page.fill("#capacity", "2");
  await page.fill("#termsVersion", "2");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.waitForURL(/\/admin\/m\/[^/?]+$/);
  await page.goto(`${base}/voluntarios/${registrationId}`);
  assert.match(await body(page), /Pendientes \(versión vigente 2\)/);
  url = await fill({ name: "Pedro Prueba Tres", doc: "1000000003", attendance: "Sí, confirmo", phone: "3001000003" });
  assert.equal(url.searchParams.get("estado"), "lista_espera");
  console.log("✓ versión de condiciones y lista de espera al agotar cupos");

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
  await page.selectOption("#organizationId", orgOpts.find((o) => o.t?.includes("KAIROS"))!.v);
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
  assert.match(usersBody, /KAIROS Life/);
  assert.match(usersBody, /\(tú\)/);
  // El coordinador aparece en la barra lateral y en el área
  await page.goto(`${base}/areas/logistica`);
  assert.match(await body(page), /Carolina Coordinadora/);
  console.log("✓ usuarios: coordinador con área, líder con grupo, consulta, duplicado rechazado");

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

  // ---------- Líder de grupo (KAIROS) ----------
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
