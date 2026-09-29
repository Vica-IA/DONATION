/**
 * Catálogos de opciones del formulario. Son la única fuente de verdad para
 * validación (zod), UI (selects) y exportación (etiquetas legibles).
 */

export type Option<T extends string = string> = { value: T; label: string };

export const DOC_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PA", label: "Pasaporte" },
  { value: "PPT", label: "Permiso por protección temporal" },
] as const satisfies readonly Option[];

export const BLOOD_TYPES = [
  { value: "O+", label: "O+" },
  { value: "O-", label: "O-" },
  { value: "A+", label: "A+" },
  { value: "A-", label: "A-" },
  { value: "B+", label: "B+" },
  { value: "B-", label: "B-" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB-" },
  { value: "NS", label: "No lo sé" },
] as const satisfies readonly Option[];

export const SHIRT_SIZES = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL" },
] as const satisfies readonly Option[];

export const ATTENDANCE = [
  { value: "confirmo", label: "Sí, confirmo mi participación" },
  { value: "no_seguro", label: "Todavía no estoy seguro/a" },
  { value: "no_puedo", label: "No podré asistir" },
] as const satisfies readonly Option[];

export const AVAILABILITY = [
  { value: "completa", label: "Todos los días de la misión" },
  { value: "parcial", label: "Solo algunos días (indica cuáles)" },
] as const satisfies readonly Option[];

export const TRANSPORT = [
  { value: "grupo", label: "Viajo con el grupo desde el punto de encuentro" },
  { value: "propio", label: "Llego por mi cuenta al territorio" },
] as const satisfies readonly Option[];

export const ROLES = [
  { value: "construccion", label: "Construcción / obra" },
  { value: "logistica", label: "Logística y transporte" },
  { value: "alimentacion", label: "Cocina y alimentación" },
  { value: "salud", label: "Salud / primeros auxilios" },
  { value: "documentacion", label: "Fotografía, video y documentación" },
  { value: "acompanamiento", label: "Acompañamiento espiritual y emocional" },
  { value: "ninos", label: "Actividades con niños y familias" },
  { value: "coordinacion", label: "Coordinación de equipo" },
  { value: "donde_necesiten", label: "Donde más se necesite" },
] as const satisfies readonly Option[];

export const SKILLS = [
  { value: "carpinteria", label: "Carpintería" },
  { value: "albanileria", label: "Albañilería" },
  { value: "electricidad", label: "Electricidad" },
  { value: "plomeria", label: "Plomería" },
  { value: "cocina", label: "Cocina" },
  { value: "primeros_auxilios", label: "Primeros auxilios" },
  { value: "medicina", label: "Medicina / enfermería" },
  { value: "psicologia", label: "Psicología" },
  { value: "conduccion", label: "Conducción" },
  { value: "foto_video", label: "Fotografía / video" },
  { value: "musica", label: "Música" },
  { value: "docencia", label: "Docencia / trabajo con niños" },
  { value: "arquitectura", label: "Arquitectura / ingeniería" },
] as const satisfies readonly Option[];

export const REGISTRATION_STATUS = [
  { value: "confirmado", label: "Confirmado" },
  { value: "lista_espera", label: "Lista de espera" },
  { value: "pendiente", label: "Pendiente" },
  { value: "cancelado", label: "Cancelado" },
] as const satisfies readonly Option[];

export const MISSION_STATUS = [
  { value: "planificacion", label: "En planificación" },
  { value: "convocatoria", label: "Convocatoria abierta" },
  { value: "en_curso", label: "En curso" },
  { value: "cerrada", label: "Cerrada" },
] as const satisfies readonly Option[];

export type DocType = (typeof DOC_TYPES)[number]["value"];
export type BloodType = (typeof BLOOD_TYPES)[number]["value"];
export type ShirtSize = (typeof SHIRT_SIZES)[number]["value"];
export type Attendance = (typeof ATTENDANCE)[number]["value"];
export type Availability = (typeof AVAILABILITY)[number]["value"];
export type Transport = (typeof TRANSPORT)[number]["value"];
export type Role = (typeof ROLES)[number]["value"];
export type Skill = (typeof SKILLS)[number]["value"];
export type RegistrationStatus = (typeof REGISTRATION_STATUS)[number]["value"];
export type MissionStatus = (typeof MISSION_STATUS)[number]["value"];

export function values<T extends string>(opts: readonly Option<T>[]): [T, ...T[]] {
  return opts.map((o) => o.value) as [T, ...T[]];
}

export function labelOf(opts: readonly Option[], value: string | null | undefined): string {
  if (!value) return "";
  return opts.find((o) => o.value === value)?.label ?? value;
}
