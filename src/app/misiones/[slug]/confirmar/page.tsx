import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/brand";
import { Progress } from "@/components/ui";
import { TermsDocument } from "@/components/terms-document";
import { getMissionBySlug, getMissionStats, listOrganizations, missionHasTerms, termsDeclarationList } from "@/lib/data";
import { isEphemeralDb } from "@/lib/db";
import { formatCOP, formatDateRange } from "@/lib/format";
import { ConfirmForm } from "./form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const mission = await getMissionBySlug(slug);
  return { title: mission ? `Confirmar participación · ${mission.name}` : "Misión" };
}

export default async function ConfirmPage({ params }: Props) {
  const { slug } = await params;
  const mission = await getMissionBySlug(slug);
  if (!mission) notFound();

  const [organizations, stats] = await Promise.all([listOrganizations(), getMissionStats(mission)]);
  const dates = formatDateRange(mission.startDate, mission.endDate);
  const terms = missionHasTerms(mission)
    ? { declarations: termsDeclarationList(mission), askImageConsent: mission.termsImageConsent, document: <TermsDocument markdown={mission.termsMarkdown!} /> }
    : null;

  return (
    <>
      <PublicHeader />
      <main className="container-narrow flex-1 py-8 sm:py-12">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{mission.code}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{mission.name}</h1>
          <p className="mt-2 text-muted">
            <span className="font-semibold text-ink">{dates}</span>
            {mission.location ? ` · ${mission.location}` : ""}
          </p>
          {mission.description ? <p className="mt-3 text-sm text-muted">{mission.description}</p> : null}
          {mission.meetingPoint ? (
            <p className="mt-2 text-sm text-muted">
              <span className="font-medium text-ink">Punto de encuentro:</span> {mission.meetingPoint}
            </p>
          ) : null}
          {mission.contributionAmount ? (
            <p className="mt-2 text-sm text-muted">
              <span className="font-medium text-ink">Aporte por persona:</span> {formatCOP(mission.contributionAmount)} aprox. (contribución a los
              costos de la misión; el cupo se separa con el pago).
            </p>
          ) : null}
          {missionHasTerms(mission) ? (
            <p className="mt-2 text-sm text-muted">
              Al final del formulario están las <span className="font-medium text-ink">condiciones de participación</span>: para enviarlo debes leerlas y aceptarlas.
            </p>
          ) : null}
          <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-brand-800">
                {stats.byStatus.confirmado} de {mission.capacity} cupos confirmados
              </span>
              <span className="text-brand-700">
                {stats.available > 0 ? `${stats.available} disponibles` : "Cupos completos · lista de espera"}
              </span>
            </div>
            <div className="mt-2">
              <Progress value={stats.byStatus.confirmado} max={mission.capacity} />
            </div>
          </div>
        </header>

        {isEphemeralDb() ? (
          <div className="card text-center">
            <h2 className="section-title">Plataforma en configuración</h2>
            <p className="mt-2 text-sm text-muted">Las inscripciones se abrirán muy pronto. Vuelve a este enlace en unos días.</p>
          </div>
        ) : mission.registrationOpen ? (
          <ConfirmForm slug={mission.slug} organizations={organizations} missionDates={dates} terms={terms} />
        ) : (
          <div className="card text-center">
            <h2 className="section-title">Inscripciones cerradas</h2>
            <p className="mt-2 text-sm text-muted">
              Esta misión ya no recibe confirmaciones. Si necesitas cambiar algo, contacta al equipo coordinador.
            </p>
          </div>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
