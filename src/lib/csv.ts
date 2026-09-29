import { AVAILABILITY, BLOOD_TYPES, DOC_TYPES, PAYMENT_STATUS, REGISTRATION_STATUS, ROLES, SKILLS, TRANSPORT, labelOf } from "./catalogs";
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
    "Parentesco",
    "Tel. emergencia",
    "Tel. emergencia 2",
    "Vacuna fiebre amarilla",
    "Póliza accidentes",
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
      v.eps,
      labelOf(BLOOD_TYPES, v.bloodType),
      v.emergencyContactName,
      v.emergencyContactRelationship,
      v.emergencyContactPhone,
      v.emergencyContactPhone2,
      v.yellowFeverVaccineDate,
      v.accidentInsurance,
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
