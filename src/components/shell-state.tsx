"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";

type ShellState = { menuOpen: boolean; setMenuOpen: (open: boolean) => void; badge: string | null };

const ShellContext = createContext<ShellState>({ menuOpen: false, setMenuOpen: () => {}, badge: null });

/** Estado compartido del panel: el cajón del menú en móvil y el estado de la misión para la cabecera. */
export function ShellProvider({ badge, children }: { badge: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // Al cambiar de página se cierra el menú (ajuste de estado durante el render, sin efectos).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }
  return <ShellContext.Provider value={{ menuOpen, setMenuOpen, badge }}>{children}</ShellContext.Provider>;
}

/** Botón "Menú" de la cabecera (solo móvil). */
export function MenuButton() {
  const { setMenuOpen } = useContext(ShellContext);
  return (
    <button
      type="button"
      onClick={() => setMenuOpen(true)}
      className="flex h-9 shrink-0 items-center rounded-[10px] border border-line-strong bg-white px-3 text-[13px] font-semibold text-ink lg:hidden"
      aria-label="Abrir el menú"
    >
      Menú
    </button>
  );
}

export function CloseMenuButton() {
  const { setMenuOpen } = useContext(ShellContext);
  return (
    <button type="button" onClick={() => setMenuOpen(false)} className="rounded-lg bg-white/[.08] px-2.5 py-1.5 text-[13px] font-semibold text-[#cfe3db]">
      Cerrar
    </button>
  );
}

/** Estado de la misión ("Salida en 3 días", "En campo · día 2"). */
export function StatusBadge({ className = "" }: { className?: string }) {
  const { badge } = useContext(ShellContext);
  if (!badge) return null;
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand-900 px-3 py-1.5 text-[13px] font-semibold text-paper ${className}`}>
      <span className="h-[7px] w-[7px] rounded-full bg-accent-500" />
      {badge}
    </span>
  );
}

/** Cajón lateral del menú en móvil. Solo existe en el DOM mientras está abierto. */
export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const { menuOpen, setMenuOpen } = useContext(ShellContext);
  if (!menuOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
      <div className="absolute inset-0 bg-ink/50" onClick={() => setMenuOpen(false)} />
      <div className="relative flex h-full w-[300px] max-w-[86%] flex-col gap-[18px] overflow-y-auto bg-brand-900 px-3.5 pb-8 pt-5 text-paper shadow-[20px_0_60px_-20px_rgba(16,35,29,.6)]">
        {children}
      </div>
    </div>
  );
}

export type BottomTab = { href: string; label: string; exact?: boolean };

/** Barra de pestañas fija al pie en móvil: las secciones principales y "Más" (abre el menú). */
export function BottomTabs({ tabs }: { tabs: BottomTab[] }) {
  const pathname = usePathname();
  const { menuOpen, setMenuOpen } = useContext(ShellContext);
  const isActive = (t: BottomTab) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`));
  const cls = (on: boolean) =>
    `flex min-h-12 flex-col items-center justify-center gap-[5px] rounded-[10px] px-0.5 py-1 text-[11px] font-semibold whitespace-nowrap ${on ? "bg-white/10 text-white" : "text-[#cfe3db]"}`;
  const dot = (on: boolean) => <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent-500" : "bg-[#5f8f7f]"}`} />;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col gap-0.5 bg-brand-900 px-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 text-paper shadow-[0_-10px_30px_-16px_rgba(16,35,29,.5)] lg:hidden"
      aria-label="Secciones"
    >
      {tabs.map((t) => {
        const on = isActive(t) && !menuOpen;
        return (
          <Link key={t.href} href={t.href} className={cls(on)}>
            {dot(on)}
            {t.label}
          </Link>
        );
      })}
      <button type="button" onClick={() => setMenuOpen(true)} className={cls(menuOpen)}>
        {dot(menuOpen)}
        Más
      </button>
    </nav>
  );
}
