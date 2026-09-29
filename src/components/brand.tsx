import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black ${
          light ? "bg-white/15 text-white" : "bg-brand-600 text-white"
        }`}
        aria-hidden
      >
        D
      </span>
      <span className="leading-tight">
        <span className={`block text-base font-extrabold tracking-wide ${light ? "text-white" : "text-ink"}`}>
          {APP_NAME}
        </span>
        <span className={`block text-[11px] ${light ? "text-white/70" : "text-slate-500"}`}>{APP_TAGLINE}</span>
      </span>
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container-narrow flex h-16 items-center justify-between">
        <Logo />
        <Link href="/admin" className="text-sm font-medium text-slate-500 hover:text-brand-700">
          Panel del equipo
        </Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-auto py-8 text-center text-xs text-slate-500">
      {APP_NAME} · {APP_TAGLINE} · Cada aporte, un impacto trazable.
    </footer>
  );
}
