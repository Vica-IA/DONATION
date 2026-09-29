import { AVAILABILITY, BLOOD_TYPES, DOC_TYPES, REGISTRATION_STATUS, ROLES, SKILLS, TRANSPORT, labelOf } from "./catalogs";
import type { RegistrationRow } from "./data";

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
    "EPS",
    "RH",
    "Contacto emergencia",
    "Tel. emergencia",
    "Condiciones médicas",
    "Alimentación",
    "Talla",
    "Habilidades",
    "Exp. construcción",
    "Respuesta",
    "Disponibilidad",
    "Detalle disponibilidad",
    "Transporte",
    "Rol preferido",
    "Rol asignado",
    "Comentarios",
    "Notas internas",
    "Confirmado el",
    "Registrado el",
  ];
  const lines = rows.map(({ registration: r, volunteer: v, organization: o }) => {
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
      v.eps,
      labelOf(BLOOD_TYPES, v.bloodType),
      v.emergencyContactName,
      v.emergencyContactPhone,
      v.medicalNotes,
      v.dietaryNotes,
      v.shirtSize,
      skills.map((s) => labelOf(SKILLS, s)).join(", "),
      v.constructionExperience ? "Sí" : "No",
      r.attendance,
      labelOf(AVAILABILITY, r.availability),
      r.availabilityNotes,
      labelOf(TRANSPORT, r.transport),
      labelOf(ROLES, r.preferredRole),
      labelOf(ROLES, r.assignedRole),
      r.comments,
      r.adminNotes,
      r.confirmedAt,
      r.createdAt,
    ]
      .map(cell)
      .join(";");
  });
  const BOM = String.fromCharCode(0xfeff);
  return BOM + [headers.map(cell).join(";"), ...lines].join("\r\n");
}
