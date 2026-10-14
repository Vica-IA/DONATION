import Link from "next/link";

/** Ventana centrada (en móvil, hoja inferior). El fondo y "Cerrar" vuelven a la vista sin el modal. */
export function Modal({ kicker, title, closeHref, children }: { kicker: string; title: string; closeHref: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <Link href={closeHref} className="absolute inset-0 bg-ink/40" aria-label="Cerrar" />
      <div className="relative flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[0_30px_80px_-20px_rgba(16,35,29,.5)] sm:rounded-[20px]">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-brand-600">{kicker}</span>
            <span className="text-[22px] font-extrabold tracking-[-0.02em]">{title}</span>
          </div>
          <Link href={closeHref} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-line-soft">
            Cerrar
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
