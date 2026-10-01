import "server-only";
import { and, eq } from "drizzle-orm";
import { BLOOD_TYPES, DOC_TYPES, PAYMENT_STATUS, REGISTRATION_STATUS, ROLES, SKILLS, type Option } from "./catalogs";
import { listOrganizations, log, termsDeclarationList, termsDocumentHash } from "./data";
import { getDb } from "./db";
import { missionRegistrations, termsAcceptances, volunteers, type Mission } from "./db/schema";
import { nowIso } from "./format";

/**
 * Importación de inscripciones desde el CSV que exporta el propio panel
 * ("Descargar CSV" de Voluntarios). Sirve para recuperar datos de otra base
 * o para cargar una lista preparada en Excel con las mismas columnas.
 * Una persona es su documento: si ya existe, se actualiza; si ya tiene
 * inscripción en la misión, se actualiza en vez de duplicarla.
 */

export type ImportSummary = { total: number; created: number; updated: number; acceptances: number; errors: { line: number; message: string }[] };

/** CSV separado por ; con comillas dobles, BOM opcional y saltos CRLF o LF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ";") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Etiqueta o valor del catálogo → valor. */
function valueOf(opts: readonly Option[], raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const hit = opts.find((o) => o.value === s || norm(o.label) === norm(s));
  return hit?.value ?? null;
}

function isoOrNull(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const REQUIRED_HEADERS = ["Nombre completo", "Documento"];

export async function importRegistrationsCsv(mission: Mission, csvText: string, actor: string): Promise<ImportSummary> {
  const rows = parseCsv(csvText);
  const summary: ImportSummary = { total: 0, created: 0, updated: 0, acceptances: 0, errors: [] };
  if (rows.length < 2) {
    summary.errors.push({ line: 1, message: "El archivo no tiene filas de datos." });
    return summary;
  }
  const headers = rows[0].map((h) => h.trim());
  const idx = new Map(headers.map((h, i) => [norm(h), i] as const));
  const col = (row: string[], name: string) => {
    const i = idx.get(norm(name));
    return i === undefined ? "" : (row[i] ?? "").trim();
  };
  for (const h of REQUIRED_HEADERS) {
    if (!idx.has(norm(h))) {
      summary.errors.push({ line: 1, message: `Falta la columna "${h}". Usa el formato del CSV que exporta el panel.` });
      return summary;
    }
  }

  const db = await getDb();
  const orgs = await listOrganizations();
  const declarations = JSON.stringify(termsDeclarationList(mission));
  const docHash = termsDocumentHash(mission);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    summary.total++;
    try {
      const fullName = col(row, "Nombre completo");
      const docNumber = col(row, "Documento").replace(/\s+/g, "");
      if (!fullName || !docNumber) throw new Error("nombre o documento vacío");
      const docType = valueOf(DOC_TYPES, col(row, "Tipo doc.")) ?? "CC";
      const grupo = col(row, "Grupo");
      const org = orgs.find((o) => norm(o.name) === norm(grupo));
      const skills = col(row, "Habilidades")
        .split(",")
        .map((s) => valueOf(SKILLS, s))
        .filter((v): v is string => Boolean(v));
      const now = nowIso();
      const volunteerValues = {
        fullName,
        docType,
        docNumber,
        birthDate: col(row, "Fecha nacimiento") || null,
        phone: col(row, "Teléfono") || "",
        email: col(row, "Correo") || null,
        city: col(row, "Ciudad") || null,
        organizationId: org?.id ?? null,
        organizationOther: org ? null : grupo || null,
        refugio: col(row, "Refugio") || null,
        eps: col(row, "EPS") || null,
        bloodType: valueOf(BLOOD_TYPES, col(row, "RH")),
        emergencyContactName: col(row, "Contacto emergencia") || null,
        emergencyContactRelationship: col(row, "Parentesco") || null,
        emergencyContactPhone: col(row, "Tel. emergencia") || null,
        emergencyContactPhone2: col(row, "Tel. emergencia 2") || null,
        accidentInsurance: col(row, "Póliza accidentes") || null,
        medicalNotes: col(row, "Condiciones médicas") || null,
        dietaryNotes: col(row, "Alimentación") || null,
        skills: JSON.stringify(skills),
        constructionExperience: /^s[ií]$/i.test(col(row, "Exp. construcción")),
        dataConsent: true,
        updatedAt: now,
      };

      const existingVolunteer = (
        await db
          .select({ id: volunteers.id })
          .from(volunteers)
          .where(and(eq(volunteers.docType, docType), eq(volunteers.docNumber, docNumber)))
          .limit(1)
      )[0];
      let volunteerId: string;
      if (existingVolunteer) {
        volunteerId = existingVolunteer.id;
        await db.update(volunteers).set(volunteerValues).where(eq(volunteers.id, volunteerId));
      } else {
        volunteerId = crypto.randomUUID();
        await db.insert(volunteers).values({ id: volunteerId, ...volunteerValues });
      }

      const status = valueOf(REGISTRATION_STATUS, col(row, "Estado")) ?? "confirmado";
      const attendance = col(row, "Respuesta") || "confirmo";
      const createdAt = isoOrNull(col(row, "Registrado el")) ?? now;
      const confirmedAt = isoOrNull(col(row, "Confirmado el")) ?? (status === "confirmado" ? createdAt : null);
      const amountRaw = col(row, "Aporte valor").replace(/[^\d.-]/g, "");
      const paymentAmount = amountRaw ? Number(amountRaw) : null;
      const registrationValues = {
        status,
        attendance,
        preferredRole: valueOf(ROLES, col(row, "Rol preferido")) ?? "",
        assignedRole: valueOf(ROLES, col(row, "Rol asignado")),
        comments: col(row, "Comentarios") || null,
        adminNotes: col(row, "Notas internas") || null,
        paymentStatus: valueOf(PAYMENT_STATUS, col(row, "Aporte")) ?? "pendiente",
        paymentAmount: paymentAmount !== null && Number.isFinite(paymentAmount) ? paymentAmount : null,
        paymentNotes: col(row, "Aporte notas") || null,
        confirmedAt,
        updatedAt: now,
      };
      const existingRegistration = (
        await db
          .select({ id: missionRegistrations.id })
          .from(missionRegistrations)
          .where(and(eq(missionRegistrations.missionId, mission.id), eq(missionRegistrations.volunteerId, volunteerId)))
          .limit(1)
      )[0];
      let registrationId: string;
      if (existingRegistration) {
        registrationId = existingRegistration.id;
        await db.update(missionRegistrations).set(registrationValues).where(eq(missionRegistrations.id, registrationId));
        summary.updated++;
      } else {
        registrationId = crypto.randomUUID();
        await db.insert(missionRegistrations).values({
          id: registrationId,
          missionId: mission.id,
          volunteerId,
          availability: "",
          availabilityNotes: null,
          transport: "",
          createdAt,
          ...registrationValues,
        });
        summary.created++;
      }

      const acceptedAt = isoOrNull(col(row, "Condiciones aceptadas el"));
      if (acceptedAt) {
        const existingAcceptance = (
          await db
            .select({ id: termsAcceptances.id })
            .from(termsAcceptances)
            .where(and(eq(termsAcceptances.registrationId, registrationId), eq(termsAcceptances.termsVersion, mission.termsVersion)))
            .limit(1)
        )[0];
        if (!existingAcceptance) {
          const img = col(row, "Autoriza imagen");
          await db.insert(termsAcceptances).values({
            id: crypto.randomUUID(),
            missionId: mission.id,
            registrationId,
            volunteerId,
            termsVersion: mission.termsVersion,
            documentHash: docHash,
            declarations,
            imageConsent: img ? /^s[ií]$/i.test(img) : null,
            signedName: fullName,
            signedDocNumber: docNumber,
            signedCity: col(row, "Ciudad") || "",
            userAgent: "importación CSV",
            acceptedAt,
          });
          summary.acceptances++;
        }
      }
      await log("registration", registrationId, existingRegistration ? "actualizada_por_admin" : "importada", `importada desde CSV (fila ${line}): ${fullName}`, actor);
    } catch (err) {
      summary.errors.push({ line, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return summary;
}
