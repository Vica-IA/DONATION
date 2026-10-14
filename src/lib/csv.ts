import { BLOOD_TYPES, DOC_TYPES, isFixedExpenseCategory, labelOf, PAYMENT_STATUS, REGISTRATION_STATUS, ROLES, SKILLS } from "./catalogs";
import type { RegistrationRow } from "./data";
import { AREAS, FINANCE_CATEGORIES, FINANCE_KINDS, GENERAL_AREA } from "./catalogs";
import type { FinanceRow } from "./finance";

export function csvCell(value: unknown): string {
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
      .map(csvCell)
      .join(";");
  });
  const BOM = String.fromCharCode(0xfeff);
  return BOM + [headers.map(csvCell).join(";"), ...lines].join("\r\n");
}

/** Movimientos financieros de una misión (mismo formato: ; y BOM). */
export function financeEntriesToCsv(rows: FinanceRow[], fundLabel: (id: string | null | undefined) => string = (id) => id ?? ""): string {
  const headers = [
    "Fecha",
    "Tipo",
    "Estado",
    "Categoría",
    "Tipo de gasto",
    "Concepto",
    "Valor (COP)",
    "Fijo / variable",
    "Fuente",
    "Proveedor / donante",
    "Cuenta",
    "Lo adelantó",
    "Reembolsado desde",
    "Referencia",
    "Registrado por",
    "Área",
    "Notas",
    "Creado por",
    "Creado el",
    "Actualizado el",
  ];
  const lines = rows.map((r) => {
    const gasto = r.kind === "gasto";
    const status = gasto
      ? r.status === "ejecutado"
        ? "Pagado"
        : r.status === "comprometido"
          ? "Comprometido"
          : "Pendiente"
      : r.status === "ejecutado"
        ? "Recibido"
        : "Estimado / prometido";
    const budgetKind = gasto ? (r.budgetKind === "fijo" || r.budgetKind === "variable" ? r.budgetKind : isFixedExpenseCategory(r.category) ? "fijo" : "variable") : "";
    return [
      r.entryDate,
      labelOf(FINANCE_KINDS, r.kind),
      status,
      labelOf(FINANCE_CATEGORIES, r.category),
      r.sub,
      r.concept,
      r.amount,
      budgetKind,
      r.source === "grupo" ? "Grupo" : r.source === "externo" ? "Fuente externa" : "",
      r.counterparty,
      r.fundId ? fundLabel(r.fundId) : "",
      r.payKind === "person" ? r.payPerson : "",
      r.reimbursedFundId ? fundLabel(r.reimbursedFundId) : "",
      r.reference,
      r.registeredBy,
      r.area ? (r.area === GENERAL_AREA.value ? GENERAL_AREA.label : labelOf(AREAS, r.area)) : "",
      r.notes,
      r.createdBy,
      r.createdAt,
      r.updatedAt,
    ]
      .map(csvCell)
      .join(";");
  });
  const BOM = String.fromCharCode(0xfeff);
  return BOM + [headers.map(csvCell).join(";"), ...lines].join("\r\n");
}
