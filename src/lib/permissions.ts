import type { UserRole } from "./catalogs";

/**
 * Permisos del panel. Cada acción sensible del panel consulta esta matriz;
 * la interfaz solo esconde botones, la seguridad real está en el servidor.
 */
export type Permission =
  | "panel.view" // ver dashboard, listas y fichas (sin datos sensibles)
  | "participants.manage" // cambiar estado, rol asignado, notas y contacto
  | "participants.sensitive" // ver salud, EPS, RH y contacto de emergencia
  | "participants.export" // descargar CSV
  | "missions.manage" // crear y editar misiones
  | "users.manage"; // crear, editar y desactivar usuarios del panel

const MATRIX: Record<UserRole, readonly Permission[]> = {
  admin: [
    "panel.view",
    "participants.manage",
    "participants.sensitive",
    "participants.export",
    "missions.manage",
    "users.manage",
  ],
  coordinador: ["panel.view", "participants.manage", "participants.sensitive", "participants.export"],
  consulta: ["panel.view"],
};

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Todo el panel: misiones, participantes, exportación y usuarios.",
  coordinador: "Gestiona participantes (estado, rol, notas, contacto), ve datos de salud y exporta CSV. No crea misiones ni usuarios.",
  consulta: "Solo lectura: cupos, listas y fichas sin datos de salud ni contacto de emergencia. No exporta.",
};

export function isUserRole(value: string): value is UserRole {
  return value in MATRIX;
}
