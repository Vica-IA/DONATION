import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/brand";
import { MissionCover, MissionLogo } from "@/components/mission-brand";
import { TermsDocument } from "@/components/terms-document";
import { getMissionBySlug, listOrganizations, missionHasTerms, termsDeclarationList } from "@/lib/data";
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

  const organizations = await listOrganizations();
  const dates = formatDateRange(mission.startDate, mission.endDate);
  const terms = missionHasTerms(mission)
    ? { declarations: termsDeclarationList(mission), askImageConsent: mission.termsImageConsent, document: <TermsDocument markdown={mission.termsMarkdown!} /> }
    : null;

  return (
    <>
      <PublicHeader />
      <main className="container-narrow flex-1 py-6 sm:py-10">
        <MissionCover mission={mission} />
        <header className="mb-8 mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <MissionLogo mission={mission} className="h-8" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{mission.code}</p>
          </div>
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
