import type { Area, UserRole } from "./catalogs";

/**
 * Permisos del panel. La interfaz solo esconde botones; la seguridad real
 * está en el servidor: cada página y acción consulta estas funciones.
 *
 * Roles:
 * - admin: control total.
 * - lider_grupo: lidera un grupo (KAIROS, Fundación Pálpitos…): gestiona y exporta a su
 *   gente, ve sus datos de salud, y puede crear y cerrar tareas propias.
 * - coordinador: coordina un área (Logística, Espiritual, Emocional,
 *   Financiero, Transporte, Alimentación): ve el equipo completo, gestiona las
 *   tareas de su área. Solo Logística ve datos de salud (primeros auxilios).
 * - consulta: solo lectura, sin datos sensibles.
 */
export type Permission =
  | "panel.view"
  | "participants.manage" // (admin: todos; líder: su grupo)
  | "participants.export" // (admin: todos; líder: su grupo)
  | "participants.delete" // (solo admin: borra la inscripción y los datos de la persona)
  | "missions.manage"
  | "users.manage"
  | "tasks.create"
  | "finance.view" // (admin, líderes y coordinadores)
  | "finance.manage"; // (admin y coordinador de Financiero, ver canManageFinance)

const MATRIX: Record<UserRole, readonly Permission[]> = {
  admin: ["panel.view", "participants.manage", "participants.export", "participants.delete", "missions.manage", "users.manage", "tasks.create", "finance.view", "finance.manage"],
  lider_grupo: ["panel.view", "participants.manage", "participants.export", "tasks.create", "finance.view"],
  coordinador: ["panel.view", "tasks.create", "finance.view"],
  consulta: ["panel.view"],
};

export type Actor = { id: string; role: UserRole; organizationId: string | null; area: Area | null };

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

/** Alcance sobre participantes: todos, solo un grupo, o ninguno. */
export function participantScope(actor: Actor): { kind: "all" } | { kind: "organization"; organizationId: string } {
  if (actor.role === "lider_grupo" && actor.organizationId) return { kind: "organization", organizationId: actor.organizationId };
  return { kind: "all" };
}

/** Puede cambiar estado, rol, notas, contacto y aporte de una inscripción. */
export function canManageRegistration(actor: Actor, organizationId: string | null): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "lider_grupo") return Boolean(actor.organizationId) && actor.organizationId === organizationId;
  return false;
}

/** Puede ver salud, EPS, RH, vacuna, póliza y contacto de emergencia. */
export function canSeeSensitive(actor: Actor, organizationId: string | null): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "lider_grupo") return Boolean(actor.organizationId) && actor.organizationId === organizationId;
  if (actor.role === "coordinador") return actor.area === "logistica";
  return false;
}

export function canExport(actor: Actor): boolean {
  return can(actor.role, "participants.export");
}

export type TaskLike = { area: string; ownerUserId: string | null };

/** Puede editar, avanzar o borrar una tarea. */
export function canEditTask(actor: Actor, task: TaskLike): boolean {
  if (actor.role === "admin") return true;
  if (task.ownerUserId && task.ownerUserId === actor.id) return true;
  if (actor.role === "coordinador") return Boolean(actor.area) && task.area === actor.area;
  return false;
}

/** Áreas en las que puede crear tareas (null = ninguna). */
export function taskAreasFor(actor: Actor): "all" | Area[] | null {
  if (actor.role === "admin" || actor.role === "lider_grupo") return "all";
  if (actor.role === "coordinador") return actor.area ? [actor.area] : null;
  return null;
}

/** Puede ver el módulo de finanzas (presupuesto, movimientos, proyecciones). */
export function canViewFinance(actor: Actor): boolean {
  return can(actor.role, "finance.view") || canManageFinance(actor);
}

/** Puede registrar, editar y borrar movimientos financieros: administrador y coordinación de Financiero. */
export function canManageFinance(actor: Actor): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "coordinador") return actor.area === "financiero";
  return false;
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Control total: misiones, participantes, tareas, finanzas, exportación y usuarios.",
  lider_grupo: "Gestiona los participantes de su grupo (estado, rol, notas, contacto, aporte), ve sus datos de salud y exporta su lista. Crea y cierra tareas propias. Consulta las finanzas.",
  coordinador: "Coordina un área: ve el equipo completo, crea y gestiona las tareas de su área y consulta las finanzas. Solo Logística ve datos de salud; solo Financiero registra movimientos.",
  consulta: "Solo lectura: cupos, listas y fichas sin datos de salud, contacto de emergencia ni finanzas. No exporta ni edita.",
};

export function isUserRole(value: string): value is UserRole {
  return value in MATRIX;
}
