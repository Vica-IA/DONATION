import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

/** Marca: casa + sol, como en el prototipo. */
export function BrandMark({ size = 34, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="10" fill={light ? "rgba(255,255,255,.12)" : "#0c3d31"} />
      <circle cx="10.5" cy="24" r="4" fill="#f0b23e" />
      <rect x="14.5" y="22.8" width="6" height="2.4" fill="#ffffff" />
      <polygon points="21,20 28,13 35,20 35,30 21,30" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ href = "/", light = false, tagline = true }: { href?: string; light?: boolean; tagline?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <BrandMark light={light} />
      <span className="leading-tight">
        <span className={`block text-[18px] font-black tracking-[-0.02em] ${light ? "text-paper" : "text-ink"}`}>
          <span className="font-medium">DO</span>
          {APP_NAME.slice(2)}
        </span>
        {tagline ? <span className={`block text-[11px] ${light ? "text-[#a9c9bd]" : "text-muted"}`}>{APP_TAGLINE}</span> : null}
      </span>
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="border-b border-line bg-white">
      <div className="container-narrow flex h-16 items-center justify-between">
        <Logo />
        <Link href="/admin" className="text-sm font-semibold text-muted hover:text-brand-700">
          Panel del equipo
        </Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-auto py-8 text-center text-xs text-muted">
      {APP_NAME} · {APP_TAGLINE} · Cada aporte, un impacto trazable.
    </footer>
  );
}
