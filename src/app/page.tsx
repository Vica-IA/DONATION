import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/brand";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import { listMissions } from "@/lib/data";
import { formatDateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const missions = await listMissions();
  const open = missions.filter((m) => m.registrationOpen);
  const closed = missions.filter((m) => !m.registrationOpen);

  return (
    <>
      <PublicHeader />
      <main className="container-narrow flex-1 py-10 sm:py-14">
        <section className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{APP_NAME}</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Misiones y voluntariado</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">{APP_DESCRIPTION}</p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="section-title">Convocatorias abiertas</h2>
          {open.length === 0 ? (
            <p className="card text-sm text-slate-500">Por ahora no hay convocatorias abiertas.</p>
          ) : (
            open.map((m) => (
              <article key={m.id} className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{m.code}</p>
                  <h3 className="text-xl font-bold">{m.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDateRange(m.startDate, m.endDate)}
                    {m.location ? ` · ${m.location}` : ""}
                  </p>
                </div>
                <Link href={`/misiones/${m.slug}/confirmar`} className="btn-primary shrink-0">
                  Confirmar participación
                </Link>
              </article>
            ))
          )}
        </section>

        {closed.length > 0 ? (
          <section className="mt-10 space-y-3">
            <h2 className="section-title">Otras misiones</h2>
            {closed.map((m) => (
              <article key={m.id} className="card py-4 text-sm">
                <span className="font-semibold">{m.name}</span>
                <span className="text-slate-500"> · {formatDateRange(m.startDate, m.endDate)} · inscripciones cerradas</span>
              </article>
            ))}
          </section>
        ) : null}
      </main>
      <PublicFooter />
    </>
  );
}
