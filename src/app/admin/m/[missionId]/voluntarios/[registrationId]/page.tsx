import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { CopyButton } from "@/components/copy-button";
import { StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ATTENDANCE, BLOOD_TYPES, DOC_TYPES, PAYMENT_STATUS, ROLES, SKILLS, labelOf } from "@/lib/catalogs";
import { siteUrl } from "@/lib/config";
import { getRegistration, listOrganizations, missionHasTerms } from "@/lib/data";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import { can, canManageRegistration, canSeeSensitive } from "@/lib/permissions";
import { deleteRegistrationAction } from "./actions";
import { ParticipantForm } from "./form";

const ACTION_LABELS: Record<string, string> = {
  creada: "Inscripción creada",
  actualizada_por_persona: "Actualizada por la persona",
  actualizada_por_admin: "Actualizada por el equipo",
  condiciones_aceptadas: "Condiciones aceptadas",
  eliminada: "Inscripción eliminada",
};

export default async function ParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ missionId: string; registrationId: string }>;
  searchParams: Promise<{ confirmar?: string }>;
}) {
  const { missionId, registrationId: id } = await params;
  const { confirmar } = await searchParams;
  const user = await requireUser(`/admin/m/${missionId}/voluntarios/${id}`);
  const [detail, organizations] = await Promise.all([getRegistration(id), listOrganizations()]);
  if (!detail || detail.mission.id !== missionId) notFound();
  const { registration: r, volunteer: v, organization: o, mission, activity, termsAcceptance, acceptances } = detail;
  // Un líder de grupo solo abre fichas de su grupo.
  if (user.role === "lider_grupo" && user.organizationId !== v.organizationId) notFound();
  const canManage = canManageRegistration(user, v.organizationId);
  const canDelete = can(user.role, "participants.delete");
  const seeSensitive = canSeeSensitive(user, v.organizationId);
  const base = `/admin/m/${mission.id}`;
  const termsUrl = `${siteUrl()}/misiones/${mission.slug}/condiciones/${r.id}`;
  const waTerms = `https://wa.me/${v.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hola ${v.fullName.split(" ")[0]}, para completar tu cupo en ${mission.name} lee y acepta las condiciones de participación aquí: ${termsUrl}`,
  )}`;
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
    ["Grupo", `${o?.name ?? v.organizationOther ?? "—"}${v.refugio ? ` · Refugio: ${v.refugio}` : ""}`],
    ["Respuesta", labelOf(ATTENDANCE, r.attendance)],
    ["Rol preferido", labelOf(ROLES, r.preferredRole) || "—"],
    ["Rol asignado", labelOf(ROLES, r.assignedRole) || "—"],
    ["Habilidades", skills.length ? skills.map((s) => labelOf(SKILLS, s)).join(", ") : "—"],
    ["Experiencia en obra", v.constructionExperience ? "Sí" : "No"],
    ["Aporte", `${labelOf(PAYMENT_STATUS, r.paymentStatus)}${r.paymentAmount ? ` · ${formatCOP(r.paymentAmount)}` : ""}${r.paymentNotes ? ` · ${r.paymentNotes}` : ""}`],
    ["Comentarios", r.comments ?? "—"],
    ["Registrado", formatDateTime(r.createdAt)],
    ["Confirmado", r.confirmedAt ? formatDateTime(r.confirmedAt) : "—"],
  ];

  // Datos de salud y emergencia: solo para quien gestiona (00.00 §25, datos sensibles).
  const sensitiveRows: [string, React.ReactNode][] = [
    ["EPS", v.eps ?? "—"],
    ["RH", labelOf(BLOOD_TYPES, v.bloodType) || "—"],
    ["Contacto de emergencia", `${v.emergencyContactName ?? "—"}${v.emergencyContactRelationship ? ` (${v.emergencyContactRelationship})` : ""} · ${v.emergencyContactPhone ?? ""}${v.emergencyContactPhone2 ? ` · ${v.emergencyContactPhone2}` : ""}`],
    ["Póliza de accidentes", v.accidentInsurance ?? "Sin registrar"],
    ["Condiciones médicas", v.medicalNotes ?? "—"],
    ["Alimentación", v.dietaryNotes ?? "—"],
  ];

  return (
    <>
      <PageHeader
        kicker={`${mission.name} · Voluntarios`}
        title={v.fullName}
        badge={<StatusBadge status={r.status} />}
        actions={
          <>
            <a href={`https://wa.me/${v.phone.replace(/\D/g, "")}`} className="btn-accent" target="_blank" rel="noopener noreferrer">
              WhatsApp {v.phone}
            </a>
            <Link href={`${base}/voluntarios`} className="btn-secondary">
              ← Voluntarios
            </Link>
          </>
        }
      />
      <PageBody>
      {v.email ? <p className="text-sm text-muted">{v.email}</p> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        {canManage ? (
          <ParticipantForm registration={r} volunteer={v} organizations={organizations} />
        ) : (
          <section className="card">
            <h2 className="section-title">Gestión</h2>
            <p className="mt-2 text-sm text-muted">
              Tu rol no gestiona esta inscripción: puedes ver la ficha, pero no cambiar estado, rol ni notas.
            </p>
            {r.adminNotes ? <p className="mt-3 rounded-lg bg-paper-2 p-3 text-sm">{r.adminNotes}</p> : null}
          </section>
        )}
        <div className="space-y-6">
          {missionHasTerms(mission) ? (
            <section className="card">
              <h2 className="section-title">Condiciones de participación</h2>
              {termsAcceptance ? (
                <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
                  <p className="font-semibold">Aceptadas el {formatDateTime(termsAcceptance.acceptedAt)} (versión {termsAcceptance.termsVersion})</p>
                  <p className="mt-1">
                    Aceptó: {termsAcceptance.signedName}{termsAcceptance.signedCity ? ` · ${termsAcceptance.signedCity}` : ""}
                    {termsAcceptance.imageConsent === null ? "" : termsAcceptance.imageConsent ? " · Autoriza uso de imagen" : " · NO autoriza uso de imagen"}
                  </p>
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Pendientes (versión vigente {mission.termsVersion})</p>
                  {acceptances.length > 0 ? <p className="mt-1">Aceptó una versión anterior (v{acceptances[0].termsVersion}) el {formatDateTime(acceptances[0].acceptedAt)}.</p> : null}
                </div>
              )}
              <p className="mt-3 break-all font-mono text-xs text-muted">{termsUrl}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton text={termsUrl} label="Copiar enlace" />
                <a className="btn-accent" href={waTerms} target="_blank" rel="noopener noreferrer">
                  Enviar por WhatsApp
                </a>
              </div>
            </section>
          ) : null}
          <section className="card">
            <h2 className="section-title">Ficha</h2>
            <dl className="mt-3 divide-y divide-line-soft text-sm">
              {rows.map(([k, val]) => (
                <div key={k} className="grid grid-cols-[140px_1fr] gap-2 py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-words">{val}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="card">
            <h2 className="section-title">Salud y emergencias</h2>
            {seeSensitive ? (
              <dl className="mt-3 divide-y divide-line-soft text-sm">
                {sensitiveRows.map(([k, val]) => (
                  <div key={k} className="grid grid-cols-[140px_1fr] gap-2 py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-words">{val}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted">Información reservada: administradores, líder del grupo y coordinación de Logística.</p>
            )}
          </section>
          <section className="card">
            <h2 className="section-title">Historial</h2>
            {activity.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Sin movimientos.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-line-soft pb-2">
                    <span>
                      <span className="font-medium">{ACTION_LABELS[a.action] ?? a.action}</span>
                      {a.detail ? <span className="text-muted"> · {a.detail}</span> : null}
                    </span>
                    <span className="text-xs text-faint">
                      {a.actor} · {formatDateTime(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {canDelete ? (
            <section className="card border-danger/30">
              <h2 className="section-title">Eliminar inscripción</h2>
              <p className="mt-2 text-sm text-muted">
                Borra la inscripción de {v.fullName} en esta misión junto con su aceptación de condiciones. Si la persona no tiene otras inscripciones, también se
                borran sus datos personales. No se puede deshacer; la bitácora conserva el registro del borrado.
              </p>
              {confirmar ? <p className="error">Marca la casilla para confirmar el borrado.</p> : null}
              <form action={deleteRegistrationAction.bind(null, r.id)} className="mt-3 space-y-3">
                <label className="choice">
                  <input type="checkbox" name="confirm" required className="mt-0.5" />
                  <span>Entiendo que se borra de forma definitiva.</span>
                </label>
                <button type="submit" className="btn-danger border border-danger/30">
                  Eliminar inscripción
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
      </PageBody>
    </>
  );
}
