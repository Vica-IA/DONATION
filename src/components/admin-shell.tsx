import Link from "next/link";
import { AreaNavLink, NavLink } from "@/components/nav-link";
import { BrandMark } from "@/components/brand";
import type { SessionUser } from "@/lib/auth";
import { AREAS, USER_ROLES, areaInfo, labelOf, type Area } from "@/lib/catalogs";
import { APP_NAME } from "@/lib/config";
import type { Mission } from "@/lib/db/schema";
import { formatDateRange, initials } from "@/lib/format";
import { isEphemeralDb } from "@/lib/db";
import { missionTimeline } from "@/lib/mission-timeline";
import { can } from "@/lib/permissions";
import type { PublicUser } from "@/lib/users";
import { logoutAction } from "@/app/admin/actions";

export type ShellCounts = { volunteers: number; openTasks: number };

type Props = {
  user: SessionUser;
  mission: Mission | null;
  counts?: ShellCounts | null;
  coordinators?: Map<Area, PublicUser>;
  children: React.ReactNode;
};

/** Consola del panel: barra lateral con misión, navegación y coordinadores. */
export function AdminShell({ user, mission, counts, coordinators, children }: Props) {
  const base = mission ? `/admin/m/${mission.id}` : null;
  const timeline = mission ? missionTimeline(mission) : null;
  const roleLabel = labelOf(USER_ROLES, user.role);
  const scope =
    user.role === "coordinador" && user.area ? areaInfo(user.area).short : user.role === "lider_grupo" && user.organizationId ? "grupo" : null;

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-5 bg-brand-900 px-3.5 py-5 text-paper lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-between px-2">
          <Link href="/admin" className="flex items-center gap-2.5">
            <BrandMark light />
            <span className="text-[18px] font-black tracking-[-0.02em]">
              <span className="font-medium">DO</span>
              {APP_NAME.slice(2)}
            </span>
          </Link>
          <Link href="/admin/cuenta" className="lg:hidden" title={user.email}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[12px] font-bold text-brand-800">{initials(user.name)}</span>
          </Link>
        </div>

        {mission ? (
          <Link href={`${base}`} className="flex flex-col gap-0.5 rounded-xl bg-white/[.07] p-3 transition hover:bg-white/10">
            <span className="mono text-[11px] text-[#a9c9bd]">{mission.code}</span>
            <span className="text-[15px] font-bold">{mission.name}</span>
            <span className="text-xs text-[#a9c9bd]">{formatDateRange(mission.startDate, mission.endDate)}</span>
            {timeline ? (
              <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold">
                <span className="h-[7px] w-[7px] rounded-full bg-accent-500" />
                {timeline.badge}
              </span>
            ) : null}
          </Link>
        ) : (
          <Link href="/admin/misiones" className="rounded-xl bg-white/[.07] p-3 text-sm text-[#cfe3db]">
            Sin misión activa. Crea una.
          </Link>
        )}

        {base ? (
          <nav className="flex flex-col gap-0.5">
            <div className="kicker px-2.5 pb-1.5 !text-[#7fa99a]">Misión</div>
            <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              <NavLink href={base} label="Resumen" match="exact" />
              <NavLink href={`${base}/voluntarios`} label="Voluntarios" count={counts?.volunteers} />
              <NavLink href={`${base}/tareas`} label="Tareas" count={counts?.openTasks} />
              <NavLink href={`${base}/areas/${AREAS[0].value}`} label="Coordinación" activePrefix={`${base}/areas/`} />
            </div>
          </nav>
        ) : null}

        {base ? (
          <nav className="hidden flex-col gap-0.5 lg:flex">
            <div className="kicker px-2.5 pb-1.5 !text-[#7fa99a]">Coordinadores</div>
            {AREAS.map((a) => {
              const person = coordinators?.get(a.value);
              return (
                <AreaNavLink
                  key={a.value}
                  href={`${base}/areas/${a.value}`}
                  initials={person ? initials(person.name) : a.initials}
                  color={a.color}
                  person={person ? person.name : "Sin asignar"}
                  area={a.short}
                />
              );
            })}
          </nav>
        ) : null}

        <nav className="flex flex-col gap-0.5 lg:mt-auto">
          <div className="kicker px-2.5 pb-1.5 !text-[#7fa99a]">Equipo</div>
          <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            <NavLink href="/admin/misiones" label="Misiones" />
            {can(user.role, "users.manage") ? <NavLink href="/admin/usuarios" label="Usuarios" /> : null}
            <NavLink href="/" label="Sitio público" match="exact" />
          </div>
          <div className="mt-3 hidden items-center gap-2.5 rounded-xl bg-white/[.07] p-2.5 lg:flex">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-bold text-brand-800">{initials(user.name)}</span>
            <Link href="/admin/cuenta" className="flex min-w-0 flex-1 flex-col" title={user.email}>
              <span className="truncate text-[13px] font-semibold text-white">{user.name}</span>
              <span className="truncate text-[11px] text-[#a9c9bd]">
                {roleLabel}
                {scope ? ` · ${scope}` : ""}
              </span>
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg px-2 py-1 text-[12px] font-semibold text-[#cfe3db] hover:bg-white/10 hover:text-white" title="Cerrar sesión">
                Salir
              </button>
            </form>
          </div>
        </nav>
      </aside>

      <main className="flex min-w-0 flex-col">
        {isEphemeralDb() ? (
          <div className="border-b border-amber-300 bg-warn-soft px-5 py-2 text-[13px] font-semibold text-warn lg:px-8" role="alert">
            Modo demostración: la base de datos es temporal y se reinicia sola. Conecta Turso en Vercel (Storage) para conservar los datos y abrir las
            inscripciones.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

/** Barra superior de cada página del panel. */
export function PageHeader({ kicker, title, actions, badge }: { kicker?: string; title: string; actions?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3 lg:px-8">
      <div className="flex flex-col">
        {kicker ? <span className="text-xs text-muted">{kicker}</span> : null}
        <span className="text-[18px] font-extrabold tracking-[-0.02em]">{title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badge}
        {actions}
      </div>
    </div>
  );
}

export function PageBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-5 px-5 py-6 lg:px-8 lg:py-7 ${className}`}>{children}</div>;
}
