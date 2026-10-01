import { getSessionUser } from "@/lib/auth";
import { DOC_TYPES, PAYMENT_STATUS, REGISTRATION_STATUS, ROLES, labelOf } from "@/lib/catalogs";
import { csvCell } from "@/lib/csv";
import { listAllRegistrations } from "@/lib/diagnostics";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** CSV de TODAS las inscripciones de la base, sin filtrar por misión (solo administrador). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (user.mustChangePassword || !can(user.role, "users.manage")) return new Response("Sin permiso", { status: 403 });
  const rows = await listAllRegistrations();
  const headers = [
    "Misión",
    "Estado",
    "Nombre completo",
    "Tipo doc.",
    "Documento",
    "Teléfono",
    "Correo",
    "Ciudad",
    "Grupo",
    "Refugio",
    "EPS",
    "RH",
    "Contacto emergencia",
    "Tel. emergencia",
    "Rol preferido",
    "Rol asignado",
    "Aporte",
    "Comentarios",
    "Condiciones aceptadas el",
    "Registrado el",
    "Id inscripción",
    "Id persona",
    "Id misión",
  ];
  const lines = rows.map((r) =>
    [
      r.mission ? r.mission.code : "(misión no encontrada)",
      labelOf(REGISTRATION_STATUS, r.registration.status) || r.registration.status,
      r.volunteer?.fullName ?? "(persona no encontrada)",
      r.volunteer ? labelOf(DOC_TYPES, r.volunteer.docType) || r.volunteer.docType : "",
      r.volunteer?.docNumber ?? "",
      r.volunteer?.phone ?? "",
      r.volunteer?.email ?? "",
      r.volunteer?.city ?? "",
      r.organization?.name ?? r.volunteer?.organizationOther ?? "",
      r.volunteer?.refugio ?? "",
      r.volunteer?.eps ?? "",
      r.volunteer?.bloodType ?? "",
      r.volunteer?.emergencyContactName ?? "",
      r.volunteer?.emergencyContactPhone ?? "",
      labelOf(ROLES, r.registration.preferredRole) || r.registration.preferredRole,
      labelOf(ROLES, r.registration.assignedRole) || r.registration.assignedRole,
      labelOf(PAYMENT_STATUS, r.registration.paymentStatus) || r.registration.paymentStatus,
      r.registration.comments ?? "",
      r.acceptedAt ?? "",
      r.registration.createdAt,
      r.registration.id,
      r.registration.volunteerId,
      r.registration.missionId,
    ]
      .map(csvCell)
      .join(";"),
  );
  const csv = "﻿" + [headers.join(";"), ...lines].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="todas-las-inscripciones-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
