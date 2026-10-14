import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/admin-shell";
import { CopyButton } from "@/components/copy-button";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/config";
import { getMissionById } from "@/lib/data";

export const metadata = { title: "Página pública" };

/** Vista previa de lo que ve cualquier voluntario sin iniciar sesión, en un marco de teléfono. */
export default async function PublicPreviewPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  await requireUser(`/admin/m/${missionId}/publica`);
  const mission = await getMissionById(missionId);
  if (!mission) notFound();
  const path = `/misiones/${mission.slug}`;
  const full = `${siteUrl()}${path}`;
  const waText = encodeURIComponent(`${mission.name}: programa, avisos y cuadrillas en ${full}`);

  return (
    <>
      <PageHeader
        kicker={mission.name}
        title="Página pública"
        actions={
          <>
            <CopyButton text={full} label="Copiar enlace" />
            <a href={path} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Abrir en una pestaña
            </a>
          </>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-start justify-center gap-8 lg:justify-start lg:gap-12">
          <div
            className="h-[760px] w-[min(390px,100%)] shrink-0 overflow-hidden rounded-[44px] bg-paper shadow-[0_0_0_10px_#10231d,0_30px_60px_-20px_rgba(16,35,29,.4)] sm:h-[844px]"
            data-public-preview
          >
            <iframe src={path} title={`Página pública de ${mission.name}`} className="h-full w-full border-0" />
          </div>
          <div className="flex max-w-[380px] flex-col gap-3.5 pt-2 lg:pt-8">
            <span className="text-[13px] font-semibold text-brand-600">Página pública · {path}</span>
            <span className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[28px]">Lo que ve cualquier voluntario, sin iniciar sesión.</span>
            <p className="text-[15px] leading-[1.55] text-muted">
              El bloque &ldquo;Ahora&rdquo; cambia solo según la fecha y la hora. Avisos fijados primero, programa por día, cuadrillas con su líder,
              logística y contacto directo con cada coordinación. Sin datos personales sensibles.
            </p>
            <p className="text-sm text-muted">Los cambios del programa, los avisos y las cuadrillas se ven aquí de inmediato.</p>
            <a className="btn-accent w-fit" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">
              Compartir por WhatsApp
            </a>
          </div>
        </div>
      </PageBody>
    </>
  );
}
