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
  | "missions.manage"
  | "users.manage"
  | "tasks.create";

const MATRIX: Record<UserRole, readonly Permission[]> = {
  admin: ["panel.view", "participants.manage", "participants.export", "missions.manage", "users.manage", "tasks.create"],
  lider_grupo: ["panel.view", "participants.manage", "participants.export", "tasks.create"],
  coordinador: ["panel.view", "tasks.create"],
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

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Control total: misiones, participantes, tareas, exportación y usuarios.",
  lider_grupo: "Gestiona los participantes de su grupo (estado, rol, notas, contacto, aporte), ve sus datos de salud y exporta su lista. Crea y cierra tareas propias.",
  coordinador: "Coordina un área: ve el equipo completo, crea y gestiona las tareas de su área. Solo Logística ve datos de salud (primeros auxilios).",
  consulta: "Solo lectura: cupos, listas y fichas sin datos de salud ni contacto de emergencia. No exporta ni edita.",
};

export function isUserRole(value: string): value is UserRole {
  return value in MATRIX;
}
