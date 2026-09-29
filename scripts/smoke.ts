/**
 * Prueba de humo de extremo a extremo (Playwright + Chromium).
 * Uso: BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/smoke.ts
 * Requiere un servidor corriendo con base de datos limpia (o al menos la misión semilla).
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@donation.local";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "donation2026";
const SLUG = "choco-2026-01";
const exe = process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

async function main() {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ locale: "es-CO", acceptDownloads: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => (m.type() === "error" ? errors.push(m.text()) : null));

  // 1. Landing
  await page.goto(`${BASE}/`);
  await page.getByRole("link", { name: "Confirmar participación" }).first().click();
  await page.waitForURL(`**/misiones/${SLUG}/confirmar`);
  assert.match(await page.textContent("body") ?? "", /0 de 40 cupos confirmados/);
  console.log("✓ landing → formulario");

  // 2. Validación: enviar vacío
  await page.getByRole("button", { name: "Enviar mi respuesta" }).click();
  await page.getByText("Revisa los campos marcados en rojo.").waitFor();
  assert.ok(await page.getByText("Indica si confirmas tu participación").isVisible());
  assert.ok(await page.getByText("Escribe tu nombre completo").isVisible());
  console.log("✓ validación de campos requeridos");

  // 3. Inscripción confirmada
  const fill = async (p: { name: string; doc: string; attendance: string; phone: string }) => {
    await page.goto(`${BASE}/misiones/${SLUG}/confirmar`);
    await page.getByLabel(new RegExp(`^${p.attendance}`)).check();
    await page.getByLabel("Todos los días de la misión").check();
    await page.getByLabel("Viajo con el grupo").check();
    await page.selectOption("#preferredRole", "construccion");
    await page.fill("#fullName", p.name);
    await page.selectOption("#docType", "CC");
    await page.fill("#docNumber", p.doc);
    await page.fill("#birthDate", "1990-05-20");
    await page.fill("#city", "Medellín");
    await page.fill("#phone", p.phone);
    await page.fill("#email", `${p.doc}@ejemplo.com`);
    const orgOptions = await page.$$eval("#organizationId option", (o) => o.map((x) => ({ v: (x as HTMLOptionElement).value, t: x.textContent })));
    const kairos = orgOptions.find((o) => o.t?.includes("KAIROS"));
    assert.ok(kairos, "KAIROS Life debe existir en el select");
    await page.selectOption("#organizationId", kairos!.v);
    await page.fill("#eps", "Sura");
    await page.selectOption("#bloodType", "O+");
    await page.fill("#emergencyContactName", "Ana Pérez");
    await page.fill("#emergencyContactPhone", "3001112233");
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
  console.log("✓ inscripción confirmada");

  url = await fill({ name: "María Prueba Dos", doc: "1000000002", attendance: "Todavía no estoy", phone: "3001000002" });
  assert.equal(url.searchParams.get("estado"), "pendiente");
  console.log("✓ inscripción pendiente");

  // 4. Misma persona vuelve a enviar: se actualiza, no se duplica
  url = await fill({ name: "Juan Prueba Uno", doc: "1.000.000.001", attendance: "Sí, confirmo", phone: "3001000009" });
  assert.equal(url.searchParams.get("actualizado"), "1");
  assert.equal(url.searchParams.get("estado"), "confirmado");
  console.log("✓ reenvío con el mismo documento actualiza el registro");

  await page.goto(`${BASE}/misiones/${SLUG}/confirmar`);
  assert.match((await page.textContent("body")) ?? "", /1 de 40 cupos confirmados/);

  // 5. Panel: requiere login con correo y contraseña
  const loginAs = async (email: string, password: string) => {
    await page.goto(`${BASE}/admin/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Entrar" }).click();
  };
  const logoutNow = async () => {
    await page.goto(`${BASE}/admin`);
    await page.getByRole("button", { name: "Salir" }).click();
    await page.waitForURL("**/admin/login**");
  };
  await page.goto(`${BASE}/admin`);
  await page.waitForURL("**/admin/login**");
  await loginAs(ADMIN_EMAIL, "incorrecta");
  await page.getByText("Correo o contraseña incorrectos.").waitFor();
  await loginAs(ADMIN_EMAIL, PASSWORD);
  await page.waitForURL(`${BASE}/admin`);
  const dash = (await page.textContent("body")) ?? "";
  assert.match(dash, /Misión Chocó 01/);
  assert.match(dash, /KAIROS Life\s*1 \/ 2/);
  assert.match(dash, /Administrador/);
  console.log("✓ login y dashboard con conteos por grupo");

  // 6. Lista de participantes + filtro
  await page.getByRole("link", { name: "Ver participantes" }).first().click();
  await page.waitForURL("**/admin/misiones/**");
  assert.match((await page.textContent("body")) ?? "", /2 registros en esta vista/);
  await page.fill('input[name="q"]', "María");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await page.waitForURL("**q=Mar%C3%ADa**");
  assert.match((await page.textContent("body")) ?? "", /1 registro en esta vista/);
  console.log("✓ lista y filtro de participantes");

  // 7. Gestionar: cambiar estado y rol
  await page.getByRole("link", { name: "Gestionar" }).first().click();
  await page.waitForURL("**/admin/participantes/**");
  await page.selectOption("#status", "confirmado");
  await page.selectOption("#assignedRole", "logistica");
  await page.fill("#adminNotes", "Nota interna de prueba");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Cambios guardados.").waitFor();
  await page.reload();
  const detail = (await page.textContent("body")) ?? "";
  assert.match(detail, /estado pendiente → confirmado/);
  assert.match(detail, /Nota interna de prueba/);
  console.log("✓ gestión de participante (estado, rol, notas, historial)");

  // 8. CSV
  const missionId = new URL(page.url()).pathname; // no lo usamos; volvemos por el dashboard
  void missionId;
  await page.goto(`${BASE}/admin`);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Descargar CSV" }).first().click()]);
  const csvPath = await download.path();
  const csv = fs.readFileSync(csvPath!, "utf8");
  assert.ok(csv.charCodeAt(0) === 0xfeff, "CSV debe iniciar con BOM para Excel");
  const lines = csv.slice(1).trim().split(/\r?\n/);
  assert.equal(lines.length, 3, "CSV: encabezado + 2 filas");
  assert.match(lines[0], /^Estado;Nombre completo;/);
  assert.match(csv, /Juan Prueba Uno/);
  assert.match(csv, /Carpintería, Primeros auxilios/);
  console.log("✓ exportación CSV");

  // 9. Cupos: bajar capacidad a 2 y confirmar una tercera persona → lista de espera
  await page.getByRole("link", { name: "Editar", exact: true }).first().click();
  await page.waitForURL("**/editar");
  await page.fill("#capacity", "2");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.waitForURL(/\/admin\/misiones\/[^/]+$/);
  url = await fill({ name: "Pedro Prueba Tres", doc: "1000000003", attendance: "Sí, confirmo", phone: "3001000003" });
  assert.equal(url.searchParams.get("estado"), "lista_espera");
  console.log("✓ lista de espera al agotar cupos");

  // 10. Cerrar inscripciones → formulario bloqueado
  await page.goto(`${BASE}/admin`);
  await page.getByRole("link", { name: "Editar", exact: true }).first().click();
  await page.getByLabel(/Inscripciones abiertas/).uncheck();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.waitForURL(/\/admin\/misiones\/[^/]+$/);
  await page.goto(`${BASE}/misiones/${SLUG}/confirmar`);
  assert.match((await page.textContent("body")) ?? "", /Inscripciones cerradas/);
  console.log("✓ cierre de inscripciones");

  // 11. Usuarios: crear coordinador con contraseña temporal
  await page.goto(`${BASE}/admin/usuarios`);
  assert.match((await page.textContent("body")) ?? "", /Usuarios del panel/);
  await page.getByRole("link", { name: "+ Nuevo usuario" }).click();
  await page.waitForURL("**/admin/usuarios/nuevo");
  await page.fill("#name", "Carolina Coordinadora");
  await page.fill("#email", "coordinadora@prueba.local");
  await page.selectOption("#role", "coordinador");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Credenciales temporales").waitFor();
  const tempPassword = (await page.locator("code.font-bold").textContent())?.trim();
  assert.ok(tempPassword && tempPassword.length >= 8, "debe mostrar la contraseña temporal");
  // duplicado por correo
  await page.goto(`${BASE}/admin/usuarios/nuevo`);
  await page.fill("#name", "Otra");
  await page.fill("#email", "coordinadora@prueba.local");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Ya existe un usuario con ese correo.").waitFor();
  // consulta con contraseña definida
  await page.goto(`${BASE}/admin/usuarios/nuevo`);
  await page.fill("#name", "Luis Lector");
  await page.fill("#email", "lector@prueba.local");
  await page.selectOption("#role", "consulta");
  await page.fill("#password", "lectura-2026");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Credenciales temporales").waitFor();
  // el admin no puede desactivarse a sí mismo (checkbox deshabilitado)
  await page.goto(`${BASE}/admin/usuarios`);
  const rowsText = (await page.textContent("body")) ?? "";
  assert.match(rowsText, /Carolina Coordinadora/);
  assert.match(rowsText, /Luis Lector/);
  assert.match(rowsText, /\(tú\)/);
  console.log("✓ creación de usuarios (coordinador y consulta), correo duplicado rechazado");

  // 12. Coordinador: cambio obligatorio de contraseña y permisos
  await logoutNow();
  await loginAs("coordinadora@prueba.local", tempPassword!);
  await page.waitForURL("**/admin/cuenta?obligatorio=1");
  await page.goto(`${BASE}/admin`);
  await page.waitForURL("**/admin/cuenta?obligatorio=1"); // bloqueada hasta cambiar
  await page.fill("#currentPassword", tempPassword!);
  await page.fill("#newPassword", "coordina-2026");
  await page.fill("#confirmPassword", "coordina-2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await page.waitForURL("**/admin?cuenta=ok");
  let body = (await page.textContent("body")) ?? "";
  assert.match(body, /Contraseña actualizada/);
  assert.match(body, /Coordinador de misión/);
  assert.doesNotMatch(body, /\+ Nueva misión/);
  assert.equal(await page.getByRole("link", { name: "Usuarios" }).count(), 0);
  await page.goto(`${BASE}/admin/usuarios`);
  await page.waitForURL("**/admin?denegado=1");
  assert.match((await page.textContent("body")) ?? "", /No tienes permiso/);
  await page.goto(`${BASE}/admin/misiones/nueva`);
  await page.waitForURL("**/admin?denegado=1");
  // sí puede gestionar participantes y ver salud
  await page.getByRole("link", { name: "Ver participantes" }).first().click();
  await page.getByRole("link", { name: "Gestionar" }).first().click();
  await page.waitForURL("**/admin/participantes/**");
  body = (await page.textContent("body")) ?? "";
  assert.match(body, /Ana Pérez/); // contacto de emergencia visible
  assert.ok(await page.locator("#status").isVisible());
  // la contraseña temporal ya no sirve (sesión anterior invalidada)
  await logoutNow();
  await loginAs("coordinadora@prueba.local", tempPassword!);
  await page.getByText("Correo o contraseña incorrectos.").waitFor();
  console.log("✓ coordinador: cambio obligatorio de contraseña, permisos correctos");

  // 13. Consulta: solo lectura, sin datos sensibles ni CSV
  await loginAs("lector@prueba.local", "lectura-2026");
  await page.waitForURL("**/admin/cuenta?obligatorio=1");
  await page.fill("#currentPassword", "lectura-2026");
  await page.fill("#newPassword", "lectura-nueva-2026");
  await page.fill("#confirmPassword", "lectura-nueva-2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await page.waitForURL("**/admin?cuenta=ok");
  body = (await page.textContent("body")) ?? "";
  assert.doesNotMatch(body, /Descargar CSV/);
  assert.doesNotMatch(body, /\+ Nueva misión/);
  await page.getByRole("link", { name: "Ver participantes" }).first().click();
  body = (await page.textContent("body")) ?? "";
  assert.doesNotMatch(body, /Descargar CSV/);
  await page.getByRole("link", { name: "Ver", exact: true }).first().click();
  await page.waitForURL("**/admin/participantes/**");
  body = (await page.textContent("body")) ?? "";
  assert.match(body, /solo consulta/);
  assert.match(body, /Información reservada/);
  assert.doesNotMatch(body, /Ana Pérez/);
  assert.equal(await page.locator("#status").count(), 0);
  const exportResp = await page.request.get(`${BASE}/admin/misiones/x/export`);
  assert.equal(exportResp.status(), 403); // autenticado, pero el rol consulta no exporta
  console.log("✓ consulta: solo lectura, sin salud ni exportación");

  // 14. Salir y protección de exportación sin sesión
  await logoutNow();
  await page.goto(`${BASE}/admin/misiones/x/export`);
  assert.match((await page.textContent("body")) ?? "", /No autorizado|login/);
  console.log("✓ logout y protección de exportación");

  if (errors.length) {
    console.warn("Errores de consola/página detectados:\n" + errors.join("\n"));
  }
  await browser.close();
  console.log("\nTODO OK");
}

main().catch((e) => {
  console.error("✗ Smoke test falló:", e);
  process.exit(1);
});
