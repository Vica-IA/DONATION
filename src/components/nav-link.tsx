"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  label: string;
  count?: number | string | null;
  /** exact: solo esa ruta; prefix: la ruta y sus hijas. */
  match?: "exact" | "prefix";
  /** Prefijo alternativo para marcar activo (p. ej. /areas/). */
  activePrefix?: string;
  /** lg: filas más altas para el menú en móvil. */
  size?: "md" | "lg";
};

export function NavLink({ href, label, count, match = "prefix", activePrefix, size = "md" }: Props) {
  const pathname = usePathname();
  const active =
    match === "exact" ? pathname === href : pathname === href || pathname.startsWith(href + "/") || (activePrefix ? pathname.startsWith(activePrefix) : false);
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 rounded-[10px] px-2.5 transition ${size === "lg" ? "py-[11px] text-[15px]" : "py-2 text-sm"} ${
        active ? "bg-white/10 font-semibold text-white" : "text-[#cfe3db] hover:bg-white/5 hover:text-white"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && count !== null && count !== "" ? <span className="mono text-[11px] text-[#a9c9bd]">{count}</span> : null}
    </Link>
  );
}

export function AreaNavLink({ href, initials, color, person, area, size = "md" }: { href: string; initials: string; color: string; person: string; area: string; size?: "md" | "lg" }) {
  const pathname = usePathname();
  const active = pathname === href;
  const big = size === "lg";
  return (
    <Link href={href} className={`flex items-center gap-2.5 rounded-[10px] px-2.5 transition ${big ? "py-2" : "py-1.5"} ${active ? "bg-white/10" : "hover:bg-white/5"}`}>
      <span className={`flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${big ? "h-7 w-7" : "h-[26px] w-[26px]"}`} style={{ background: color }}>
        {initials}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={`truncate font-semibold text-white ${big ? "text-sm" : "text-[13px]"}`}>{person}</span>
        <span className="text-[11px] text-[#a9c9bd]">{area}</span>
      </span>
    </Link>
  );
}
