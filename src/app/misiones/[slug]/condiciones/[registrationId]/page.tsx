import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/brand";
import { TermsDocument } from "@/components/terms-document";
import { getTermsContext, missionHasTerms, termsDeclarationList } from "@/lib/data";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { TermsForm } from "./form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; registrationId: string }>;
  searchParams: Promise<{ ok?: string }>;
};

export const metadata: Metadata = { title: "Condiciones de participación", robots: { index: false } };

export default async function TermsPage({ params, searchParams }: Props) {
  const { slug, registrationId } = await params;
  const { ok } = await searchParams;
  const ctx = await getTermsContext(slug, registrationId);
  if (!ctx) notFound();
  const { mission, volunteer, acceptance } = ctx;
  const declarations = termsDeclarationList(mission);

  return (
    <>
      <PublicHeader />
      <main className="container-narrow flex-1 py-8 sm:py-12">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{mission.name}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Condiciones de participación</h1>
          <p className="mt-2 text-sm text-muted">
            {formatDateRange(mission.startDate, mission.endDate)} · Para: <span className="font-medium text-ink">{volunteer.fullName}</span>
          </p>
        </header>

        {!missionHasTerms(mission) ? (
          <div className="card text-sm text-muted">Esta misión todavía no tiene condiciones de participación publicadas.</div>
        ) : acceptance ? (
          <>
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-brand-900" role="status">
              <h2 className="text-xl font-bold">{ok ? "¡Gracias! Condiciones aceptadas" : "Ya aceptaste estas condiciones"}</h2>
              <p className="mt-2 text-sm">
                Aceptadas el {formatDateTime(acceptance.acceptedAt)} (versión {acceptance.termsVersion}) por {acceptance.signedName}
                {acceptance.signedCity ? `, desde ${acceptance.signedCity}` : ""}.
                {acceptance.imageConsent === null ? "" : acceptance.imageConsent ? " Autorizaste el uso de tu imagen." : " No autorizaste el uso de tu imagen."}
              </p>
              <p className="mt-2 text-xs text-brand-800">Si el documento cambia de fondo, te pediremos aceptarlo de nuevo.</p>
            </div>
            <details className="card mt-6">
              <summary className="cursor-pointer text-sm font-semibold">Ver el documento aceptado</summary>
              <div className="mt-4">
                <TermsDocument markdown={mission.termsMarkdown!} />
              </div>
            </details>
            <div className="mt-6">
              <Link href="/" className="btn-ghost">
                Volver al inicio
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Lee el documento completo. Al final, marca la casilla y acepta.
            </div>
            <article className="card mt-6">
              <TermsDocument markdown={mission.termsMarkdown!} />
            </article>
            <div className="mt-8">
              <TermsForm
                slug={mission.slug}
                registrationId={registrationId}
                declarations={declarations}
                askImageConsent={mission.termsImageConsent}
                fullName={volunteer.fullName}
              />
            </div>
          </>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
