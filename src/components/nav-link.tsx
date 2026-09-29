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
};

export function NavLink({ href, label, count, match = "prefix", activePrefix }: Props) {
  const pathname = usePathname();
  const active =
    match === "exact" ? pathname === href : pathname === href || pathname.startsWith(href + "/") || (activePrefix ? pathname.startsWith(activePrefix) : false);
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-sm transition ${
        active ? "bg-white/10 font-semibold text-white" : "text-[#cfe3db] hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span className={`h-1.5 w-1.5 rounded-[2px] ${active ? "bg-accent-500" : "bg-[#5f8f7f]"}`} />
        {label}
      </span>
      {count !== undefined && count !== null && count !== "" ? <span className="mono text-[11px] text-[#a9c9bd]">{count}</span> : null}
    </Link>
  );
}

export function AreaNavLink({ href, initials, color, person, area }: { href: string; initials: string; color: string; person: string; area: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href} className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 transition ${active ? "bg-white/10" : "hover:bg-white/5"}`}>
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
        {initials}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-white">{person}</span>
        <span className="text-[11px] text-[#a9c9bd]">{area}</span>
      </span>
    </Link>
  );
}
