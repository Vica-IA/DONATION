import { BLOOD_TYPES, DOC_TYPES, PAYMENT_STATUS, REGISTRATION_STATUS, ROLES, SKILLS, labelOf } from "./catalogs";
import type { RegistrationRow } from "./data";
import { AREAS, FINANCE_CATEGORIES, FINANCE_KINDS, FINANCE_STATUS, GENERAL_AREA } from "./catalogs";
import type { FinanceRow } from "./finance";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV separado por ; (Excel en español) con BOM para tildes correctas. */
export function registrationsToCsv(rows: RegistrationRow[]): string {
  const headers = [
    "Estado",
    "Nombre completo",
    "Tipo doc.",
    "Documento",
    "Fecha nacimiento",
    "Teléfono",
    "Correo",
    "Ciudad",
    "Grupo",
    "Refugio",
    "EPS",
    "RH",
    "Contacto emergencia",
    "Parentesco",
    "Tel. emergencia",
    "Tel. emergencia 2",
    "Póliza accidentes",
    "Condiciones médicas",
    "Alimentación",
    "Talla",
    "Habilidades",
    "Exp. construcción",
    "Respuesta",
    "Rol preferido",
    "Rol asignado",
    "Comentarios",
    "Notas internas",
    "Aporte",
    "Aporte valor",
    "Aporte notas",
    "Condiciones aceptadas el",
    "Autoriza imagen",
    "Confirmado el",
    "Registrado el",
  ];
  const lines = rows.map(({ registration: r, volunteer: v, organization: o, termsAcceptedAt, imageConsent }) => {
    let skills: string[] = [];
    try {
      skills = JSON.parse(v.skills);
    } catch {
      skills = [];
    }
    return [
      labelOf(REGISTRATION_STATUS, r.status),
      v.fullName,
      labelOf(DOC_TYPES, v.docType),
      v.docNumber,
      v.birthDate,
      v.phone,
      v.email,
      v.city,
      o?.name ?? v.organizationOther ?? "",
      v.refugio,
      v.eps,
      labelOf(BLOOD_TYPES, v.bloodType),
      v.emergencyContactName,
      v.emergencyContactRelationship,
      v.emergencyContactPhone,
      v.emergencyContactPhone2,
      v.accidentInsurance,
      v.medicalNotes,
      v.dietaryNotes,
      v.shirtSize,
      skills.map((s) => labelOf(SKILLS, s)).join(", "),
      v.constructionExperience ? "Sí" : "No",
      r.attendance,
      labelOf(ROLES, r.preferredRole),
      labelOf(ROLES, r.assignedRole),
      r.comments,
      r.adminNotes,
      labelOf(PAYMENT_STATUS, r.paymentStatus),
      r.paymentAmount,
      r.paymentNotes,
      termsAcceptedAt,
      imageConsent === null ? "" : imageConsent ? "Sí" : "No",
      r.confirmedAt,
      r.createdAt,
    ]
      .map(cell)
      .join(";");
  });
  const BOM = String.fromCharCode(0xfeff);
  return BOM + [headers.map(cell).join(";"), ...lines].join("\r\n");
}

/** Movimientos financieros de una misión (mismo formato: ; y BOM). */
export function financeEntriesToCsv(rows: FinanceRow[]): string {
  const headers = ["Fecha", "Tipo", "Estado", "Categoría", "Concepto", "Valor (COP)", "Área", "Proveedor / donante", "Referencia", "Responsable", "Notas", "Registrado por", "Registrado el", "Actualizado el"];
  const lines = rows.map((r) =>
    [
      r.entryDate,
      labelOf(FINANCE_KINDS, r.kind),
      labelOf(FINANCE_STATUS, r.status),
      labelOf(FINANCE_CATEGORIES, r.category),
      r.concept,
      r.amount,
      r.area ? (r.area === GENERAL_AREA.value ? GENERAL_AREA.label : labelOf(AREAS, r.area)) : "",
      r.counterparty,
      r.reference,
      r.ownerName,
      r.notes,
      r.createdBy,
      r.createdAt,
      r.updatedAt,
    ]
      .map(cell)
      .join(";"),
  );
  const BOM = String.fromCharCode(0xfeff);
  return BOM + [headers.map(cell).join(";"), ...lines].join("\r\n");
}
