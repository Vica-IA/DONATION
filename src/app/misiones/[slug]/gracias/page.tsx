import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/brand";
import { MissionLogo } from "@/components/mission-brand";
import { getMissionBySlug, getTermsContext, missionHasTerms } from "@/lib/data";
import { formatDateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ estado?: string; nombre?: string; actualizado?: string; r?: string }>;
};

const COPY: Record<string, { title: string; body: string; tone: string }> = {
  confirmado: {
    title: "¡Tu cupo está confirmado!",
    body: "Gracias por sumarte. El equipo coordinador te contactará por WhatsApp con la logística: transporte, alojamiento y lo que debes llevar.",
    tone: "bg-brand-50 border-brand-200 text-brand-800",
  },
  lista_espera: {
    title: "Quedaste en lista de espera",
    body: "Los cupos ya están completos, pero registramos tu interés. Si se libera un cupo te avisaremos de inmediato.",
    tone: "bg-amber-50 border-amber-200 text-amber-800",
  },
  pendiente: {
    title: "Registramos tu respuesta",
    body: "Sabemos que aún no estás seguro/a. Cuando lo tengas claro, vuelve a este formulario con tu mismo documento y confirma: tu registro se actualizará.",
    tone: "bg-paper-2 border-line text-ink",
  },
  cancelado: {
    title: "Gracias por avisarnos",
    body: "Registramos que no podrás asistir esta vez. Si cambian tus planes, puedes volver a este formulario y confirmar.",
    tone: "bg-paper-2 border-line text-ink",
  },
};

export default async function ThanksPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { estado, nombre, actualizado, r } = await searchParams;
  const mission = await getMissionBySlug(slug);
  if (!mission) notFound();
  const copy = COPY[estado ?? ""] ?? COPY.pendiente;
  const needsTerms = (estado === "confirmado" || estado === "lista_espera") && missionHasTerms(mission) && Boolean(r);
  const termsCtx = needsTerms ? await getTermsContext(slug, r!) : null;
  const termsPending = Boolean(termsCtx && !termsCtx.acceptance);

  return (
    <>
      <PublicHeader />
      <main className="container-narrow flex flex-1 flex-col justify-center py-12">
        <div className={`rounded-2xl border p-6 sm:p-8 ${copy.tone}`}>
          <MissionLogo mission={mission} className="mb-3 h-7" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">{mission.name}</p>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            {nombre ? `${nombre}: ` : ""}
            {copy.title}
          </h1>
          <p className="mt-3 text-sm sm:text-base">{copy.body}</p>
          {actualizado ? <p className="mt-2 text-xs opacity-70">Ya tenías un registro para esta misión: lo actualizamos con tu nueva respuesta.</p> : null}
          <p className="mt-4 text-sm font-medium">Fechas: {formatDateRange(mission.startDate, mission.endDate)}</p>
          {mission.departureNote || mission.returnNote ? (
            <p className="mt-1 text-sm">
              {mission.departureNote ? `Salida: ${mission.departureNote}` : ""}
              {mission.departureNote && mission.returnNote ? " · " : ""}
              {mission.returnNote ? `Llegada: ${mission.returnNote}` : ""}
            </p>
          ) : null}
        </div>
        {termsPending ? (
          <div className="card mt-6 border-brand-300">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Paso 2 de 2</p>
            <h2 className="mt-1 text-xl font-bold">Lee y acepta las condiciones de participación</h2>
            <p className="mt-2 text-sm text-muted">
              Es el consentimiento informado de la misión: requisitos, riesgos del territorio, reglas de seguridad y tratamiento de datos.
              Tu cupo queda completo cuando lo aceptas{mission.contributionAmount ? " y realizas el aporte" : ""}.
            </p>
            <Link href={`/misiones/${mission.slug}/condiciones/${r}`} className="btn-primary mt-4 w-full py-3 text-base sm:w-auto">
              Leer y aceptar las condiciones
            </Link>
          </div>
        ) : termsCtx?.acceptance ? (
          <p className="mt-4 text-sm text-brand-800">Ya aceptaste las condiciones de participación. ¡Gracias!</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/misiones/${mission.slug}/confirmar`} className="btn-secondary">
            Editar mi respuesta
          </Link>
          <Link href="/" className="btn-ghost">
            Volver al inicio
          </Link>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
