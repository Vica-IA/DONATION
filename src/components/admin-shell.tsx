import Link from "next/link";
import { AreaNavLink, NavLink } from "@/components/nav-link";
import { BrandMark } from "@/components/brand";
import { BottomTabs, CloseMenuButton, MenuButton, MobileDrawer, ShellProvider, StatusBadge, type BottomTab } from "@/components/shell-state";
import type { SessionUser } from "@/lib/auth";
import { AREAS, USER_ROLES, areaInfo, labelOf, type Area } from "@/lib/catalogs";
import { APP_NAME } from "@/lib/config";
import type { Mission } from "@/lib/db/schema";
import { formatDateRange, initials } from "@/lib/format";
import { dbMode, isDurableDb } from "@/lib/db";
import { missionTimeline } from "@/lib/mission-timeline";
import { can, canViewFinance } from "@/lib/permissions";
import type { PublicUser } from "@/lib/users";
import { logoutAction } from "@/app/admin/actions";

export type ShellCounts = { volunteers: number; openTasks: number; activities: number; announcements: number };

type Props = {
  user: SessionUser;
  mission: Mission | null;
  counts?: ShellCounts | null;
  coordinators?: Map<Area, PublicUser>;
  children: React.ReactNode;
};

function Brand({ size = 34 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={size} light />
      <span className="text-[18px] font-black tracking-[-0.02em]">
        <span className="font-medium">DO</span>
        {APP_NAME.slice(2)}
      </span>
    </span>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav className="flex flex-col gap-0.5">
      <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7fa99a]">{title}</div>
      {children}
    </nav>
  );
}

/** Grupos de navegación: los mismos en la barra lateral (md) y en el menú móvil (lg). */
function ShellNav({ user, mission, counts, coordinators, size }: { user: SessionUser; mission: Mission | null; counts?: ShellCounts | null; coordinators?: Map<Area, PublicUser>; size: "md" | "lg" }) {
  const base = mission ? `/admin/m/${mission.id}` : null;
  const program = Boolean(mission) && can(user.role, "program.manage");
  return (
    <>
      {base ? (
        <Group title="Misión">
          <NavLink href={base} label="Resumen" match="exact" size={size} />
          {program ? <NavLink href={`${base}/programa`} label="Programa" count={counts?.activities} size={size} /> : null}
          <NavLink href={`${base}/areas/${AREAS[0].value}`} label="Coordinación" activePrefix={`${base}/areas/`} size={size} />
          <NavLink href={`${base}/voluntarios`} label="Voluntarios" count={counts?.volunteers} size={size} />
          {program ? <NavLink href={`${base}/cuadrillas`} label="Cuadrillas" size={size} /> : null}
          <NavLink href={`${base}/tareas`} label="Tareas" count={counts?.openTasks} size={size} />
        </Group>
      ) : null}
      {base && (canViewFinance(user) || program) ? (
        <Group title="Recursos y comunicación">
          {canViewFinance(user) ? <NavLink href={`${base}/finanzas`} label="Finanzas" size={size} /> : null}
          {program ? <NavLink href={`${base}/avisos`} label="Avisos" count={counts?.announcements} size={size} /> : null}
          {program ? <NavLink href={`${base}/publica`} label="Página pública" match="exact" size={size} /> : null}
        </Group>
      ) : null}
      {base ? (
        <Group title="Coordinadores">
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
                size={size}
              />
            );
          })}
        </Group>
      ) : null}
      <Group title="Equipo">
        <NavLink href="/admin/misiones" label="Misiones" size={size} />
        {can(user.role, "users.manage") ? <NavLink href="/admin/usuarios" label="Usuarios" size={size} /> : null}
        {can(user.role, "users.manage") ? <NavLink href="/admin/diagnostico" label="Diagnóstico" size={size} /> : null}
        <NavLink href="/" label="Sitio público" match="exact" size={size} />
      </Group>
    </>
  );
}

function MissionCard({ mission, badge, compact = false }: { mission: Mission | null; badge: string | null; compact?: boolean }) {
  if (!mission) {
    return (
      <Link href="/admin/misiones" className="rounded-xl bg-white/[.07] p-3 text-sm text-[#cfe3db]">
        Sin misión activa. Crea una.
      </Link>
    );
  }
  return (
    <Link href={`/admin/m/${mission.id}`} className="flex flex-col gap-0.5 rounded-xl bg-white/[.07] p-3 transition hover:bg-white/10">
      <span className="mono text-[11px] text-[#a9c9bd]">{mission.code}</span>
      <span className="text-[15px] font-bold">{mission.name}</span>
      <span className="text-xs text-[#a9c9bd]">
        {formatDateRange(mission.startDate, mission.endDate)}
        {compact && badge ? ` · ${badge}` : ""}
      </span>
      {!compact && badge ? (
        <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold">
          <span className="h-[7px] w-[7px] rounded-full bg-accent-500" />
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function UserCard({ user }: { user: SessionUser }) {
  const roleLabel = labelOf(USER_ROLES, user.role);
  const scope =
    user.role === "coordinador" && user.area ? areaInfo(user.area).short : user.role === "lider_grupo" && user.organizationId ? "grupo" : null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[.07] p-2.5">
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
  );
}

/** Consola del panel: barra lateral en escritorio; cabecera con menú, cajón lateral y pestañas al pie en móvil. */
export function AdminShell({ user, mission, counts, coordinators, children }: Props) {
  const base = mission ? `/admin/m/${mission.id}` : null;
  const timeline = mission ? missionTimeline(mission) : null;
  const badge = timeline?.badge ?? null;
  const mode = dbMode();
  const modeLabel = mode === "turso" ? "Base de datos: Turso" : mode === "ephemeral" ? "Base de datos: temporal (NO conserva datos)" : "Base de datos: local (archivo)";
  const tabs: BottomTab[] = base
    ? [
        { href: base, label: "Resumen", exact: true },
        ...(can(user.role, "program.manage") ? [{ href: `${base}/programa`, label: "Programa" }] : [{ href: `${base}/voluntarios`, label: "Voluntarios" }]),
        ...(canViewFinance(user) ? [{ href: `${base}/finanzas`, label: "Finanzas" }] : []),
        { href: `${base}/tareas`, label: "Tareas" },
      ]
    : [{ href: "/admin/misiones", label: "Misiones" }];

  return (
    <ShellProvider badge={badge}>
      <div className="min-h-full lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden bg-brand-900 px-3.5 py-5 text-paper lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-[18px] lg:overflow-y-auto">
          <Link href="/admin" className="px-2">
            <Brand />
          </Link>
          <MissionCard mission={mission} badge={badge} />
          <ShellNav user={user} mission={mission} counts={counts} coordinators={coordinators} size="md" />
          <div className="mt-auto flex flex-col gap-2">
            {user.role === "admin" ? (
              <div className="px-2.5 text-[11px] text-[#7fa99a]" title="Origen de los datos de este despliegue">
                {modeLabel}
              </div>
            ) : null}
            <UserCard user={user} />
          </div>
        </aside>

        <main className="flex min-w-0 flex-col pb-[76px] lg:pb-0">
          {!isDurableDb() ? (
            <div className="border-b border-danger/40 bg-danger-soft px-4 py-2 text-[13px] font-semibold text-danger lg:px-8" role="alert">
              Atención: la base de datos de este despliegue NO conserva los datos. Es un archivo temporal que se reinicia con cada instancia o
              despliegue: las inscripciones y los usuarios se pierden. Conecta Turso en Vercel (Storage → Connect Project) y redespliega antes de
              recibir inscripciones.
            </div>
          ) : null}
          {children}
        </main>
      </div>

      <MobileDrawer>
        <div className="flex items-center justify-between px-2">
          <Brand size={32} />
          <CloseMenuButton />
        </div>
        <MissionCard mission={mission} badge={badge} compact />
        <ShellNav user={user} mission={mission} counts={counts} coordinators={coordinators} size="lg" />
        {user.role === "admin" ? <div className="px-2.5 text-[11px] text-[#7fa99a]">{modeLabel}</div> : null}
        <UserCard user={user} />
      </MobileDrawer>
      <BottomTabs tabs={tabs} />
    </ShellProvider>
  );
}

/** Barra superior de cada página del panel: en móvil lleva el logo y el botón del menú. */
export function PageHeader({ kicker, title, actions, badge }: { kicker?: string; title: string; actions?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-white px-3.5 py-2.5 lg:px-8 lg:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Link href="/admin" className="flex shrink-0 lg:hidden" aria-label="Centro de misión">
          <BrandMark size={32} />
        </Link>
        <div className="flex min-w-0 flex-col">
          {kicker ? <span className="truncate text-xs text-muted">{kicker}</span> : null}
          <span className="truncate text-[18px] font-extrabold tracking-[-0.02em]">{title}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {badge ? <span className="hidden items-center sm:flex">{badge}</span> : null}
        {actions}
        <StatusBadge className="hidden md:inline-flex" />
        <MenuButton />
      </div>
    </div>
  );
}

export function PageBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-4 px-3.5 py-4 lg:gap-5 lg:px-8 lg:py-7 ${className}`}>{children}</div>;
}
