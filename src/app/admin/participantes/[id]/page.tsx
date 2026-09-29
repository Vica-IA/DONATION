import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ATTENDANCE, AVAILABILITY, BLOOD_TYPES, DOC_TYPES, ROLES, SKILLS, TRANSPORT, labelOf } from "@/lib/catalogs";
import { getRegistration, listOrganizations } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { ParticipantForm } from "./form";

const ACTION_LABELS: Record<string, string> = {
  creada: "Inscripción creada",
  actualizada_por_persona: "Actualizada por la persona",
  actualizada_por_admin: "Actualizada por el equipo",
};

export default async function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/admin/participantes/${id}`);
  const canManage = can(user.role, "participants.manage");
  const canSeeSensitive = can(user.role, "participants.sensitive");
  const [detail, organizations] = await Promise.all([getRegistration(id), listOrganizations()]);
  if (!detail) notFound();
  const { registration: r, volunteer: v, organization: o, mission, activity } = detail;
  let skills: string[] = [];
  try {
    skills = JSON.parse(v.skills);
  } catch {
    skills = [];
  }

  const rows: [string, React.ReactNode][] = [
    ["Documento", `${labelOf(DOC_TYPES, v.docType)} ${v.docNumber}`],
    ["Fecha de nacimiento", formatDate(v.birthDate) || "—"],
    ["Ciudad", v.city ?? "—"],
    ["Grupo", o?.name ?? v.organizationOther ?? "—"],
    ["Respuesta", labelOf(ATTENDANCE, r.attendance)],
    ["Disponibilidad", `${labelOf(AVAILABILITY, r.availability)}${r.availabilityNotes ? ` · ${r.availabilityNotes}` : ""}`],
    ["Transporte", labelOf(TRANSPORT, r.transport)],
    ["Rol preferido", labelOf(ROLES, r.preferredRole) || "—"],
    ["Rol asignado", labelOf(ROLES, r.assignedRole) || "—"],
    ["Habilidades", skills.length ? skills.map((s) => labelOf(SKILLS, s)).join(", ") : "—"],
    ["Experiencia en obra", v.constructionExperience ? "Sí" : "No"],
    ["Talla camiseta", v.shirtSize ?? "—"],
    ["Comentarios", r.comments ?? "—"],
    ["Registrado", formatDateTime(r.createdAt)],
    ["Confirmado", r.confirmedAt ? formatDateTime(r.confirmedAt) : "—"],
  ];

  // Datos de salud y emergencia: solo para quien gestiona (00.00 §25, datos sensibles).
  const sensitiveRows: [string, React.ReactNode][] = [
    ["EPS", v.eps ?? "—"],
    ["RH", labelOf(BLOOD_TYPES, v.bloodType) || "—"],
    ["Contacto de emergencia", `${v.emergencyContactName ?? "—"} · ${v.emergencyContactPhone ?? ""}`],
    ["Condiciones médicas", v.medicalNotes ?? "—"],
    ["Alimentación", v.dietaryNotes ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/misiones/${mission.id}`} className="text-xs text-slate-500 hover:text-brand-700">
          ← {mission.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{v.fullName}</h1>
          <StatusBadge status={r.status} />
        </div>
        <p className="text-sm text-slate-600">
          <a href={`https://wa.me/${v.phone.replace(/\D/g, "")}`} className="text-brand-700 hover:underline" target="_blank" rel="noopener noreferrer">
            {v.phone}
          </a>
          {v.email ? ` · ${v.email}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {canManage ? (
          <ParticipantForm registration={r} volunteer={v} organizations={organizations} />
        ) : (
          <section className="card">
            <h2 className="section-title">Gestión</h2>
            <p className="mt-2 text-sm text-slate-500">
              Tu rol es de solo consulta: puedes ver la ficha, pero no cambiar estado, rol ni notas.
            </p>
            {r.adminNotes ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">{r.adminNotes}</p> : null}
          </section>
        )}
        <div className="space-y-6">
          <section className="card">
            <h2 className="section-title">Ficha</h2>
            <dl className="mt-3 divide-y divide-slate-100 text-sm">
              {rows.map(([k, val]) => (
                <div key={k} className="grid grid-cols-[140px_1fr] gap-2 py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="break-words">{val}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="card">
            <h2 className="section-title">Salud y emergencias</h2>
            {canSeeSensitive ? (
              <dl className="mt-3 divide-y divide-slate-100 text-sm">
                {sensitiveRows.map(([k, val]) => (
                  <div key={k} className="grid grid-cols-[140px_1fr] gap-2 py-2">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="break-words">{val}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Información reservada al equipo coordinador.</p>
            )}
          </section>
          <section className="card">
            <h2 className="section-title">Historial</h2>
            {activity.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin movimientos.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                    <span>
                      <span className="font-medium">{ACTION_LABELS[a.action] ?? a.action}</span>
                      {a.detail ? <span className="text-slate-500"> · {a.detail}</span> : null}
                    </span>
                    <span className="text-xs text-slate-400">
                      {a.actor} · {formatDateTime(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
