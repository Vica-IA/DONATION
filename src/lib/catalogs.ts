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

export const ATTENDANCE = [
  { value: "confirmo", label: "Sí, confirmo mi participación" },
  { value: "no_seguro", label: "Todavía no estoy seguro/a" },
  { value: "no_puedo", label: "No podré asistir" },
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

export const PAYMENT_STATUS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "pagado", label: "Pagado" },
  { value: "parcial", label: "Pago parcial" },
  { value: "exento", label: "Exento" },
] as const satisfies readonly Option[];

export const USER_ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "lider_grupo", label: "Líder de grupo" },
  { value: "coordinador", label: "Coordinador de área" },
  { value: "consulta", label: "Solo consulta" },
] as const satisfies readonly Option[];

/** Grupo Kairós se organiza en refugios: el formulario pide el refugio cuando se elige este grupo. */
export const KAIROS_SLUG = "grupo-kairos";

/** Áreas de coordinación de una misión. El orden es el de la interfaz. */
export const AREAS = [
  { value: "logistica", label: "Logística", short: "Logística", initials: "LO", color: "#157a5e", description: "Alojamiento, herramientas, equipos de protección, comunicaciones, energía, botiquín y emergencias." },
  { value: "transporte", label: "Transporte", short: "Transporte", initials: "TR", color: "#2f6fa3", description: "Movimiento de personas, mercados y materiales: Medellín → Chocó, traslados internos y fletes hasta la obra." },
  { value: "alimentacion", label: "Alimentación", short: "Alimentación", initials: "AL", color: "#b8621b", description: "Menús, compras de víveres, cocina en campo, raciones diarias, agua potable y restricciones alimentarias del equipo." },
  { value: "financiero", label: "Financiero", short: "Financiero", initials: "FI", color: "#c4830f", description: "Registro de donaciones, control presupuestal, compras con doble aprobación, gastos de campo y conciliación posterior." },
  { value: "espiritual", label: "Acompañamiento espiritual", short: "Espiritual", initials: "ES", color: "#7a5ea8", description: "Vida espiritual del equipo y enlace con el sacerdote y la comunidad: oraciones, Eucaristía y bendición de la vivienda." },
  { value: "emocional", label: "Acompañamiento emocional", short: "Emocional", initials: "EM", color: "#b4506f", description: "Acompañamiento psicológico a la familia y la comunidad, actividades con niños y cuidado emocional del equipo." },
] as const;

export type Area = (typeof AREAS)[number]["value"];
export type AreaInfo = (typeof AREAS)[number];

/** Área especial para tareas de dirección (sin coordinador de área). */
export const GENERAL_AREA = { value: "general", label: "Dirección de misión", short: "Dirección", initials: "DI", color: "#10231d", description: "Decisiones generales: familia, vivienda, presupuesto, equipo y criterios Go / No-Go." } as const;

export function areaInfo(value: string | null | undefined): AreaInfo | typeof GENERAL_AREA {
  return AREAS.find((a) => a.value === value) ?? GENERAL_AREA;
}

export function isArea(value: string): value is Area {
  return AREAS.some((a) => a.value === value);
}

/** Roles de voluntario (catálogo ROLES) que trabajan con cada área. */
export const AREA_VOLUNTEER_ROLES: Record<Area, readonly string[]> = {
  logistica: ["logistica", "salud"],
  transporte: [],
  alimentacion: ["alimentacion"],
  financiero: [],
  espiritual: ["acompanamiento"],
  emocional: ["acompanamiento", "ninos"],
};

export const TASK_STATUS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_curso", label: "En curso" },
  { value: "hecha", label: "Hecha" },
] as const satisfies readonly Option[];

export type TaskStatus = (typeof TASK_STATUS)[number]["value"];

/** Tipos de movimiento financiero. */
export const FINANCE_KINDS = [
  { value: "gasto", label: "Gasto" },
  { value: "ingreso", label: "Ingreso" },
] as const satisfies readonly Option[];

/** Estado de un movimiento: de la proyección a la ejecución. */
export const FINANCE_STATUS = [
  { value: "proyectado", label: "Proyectado" },
  { value: "comprometido", label: "Comprometido" },
  { value: "ejecutado", label: "Ejecutado" },
] as const satisfies readonly Option[];

export type FinanceKind = (typeof FINANCE_KINDS)[number]["value"];
export type FinanceStatus = (typeof FINANCE_STATUS)[number]["value"];

export const FINANCE_STATUS_HELP: Record<FinanceStatus, string> = {
  proyectado: "Presupuesto o proyección: todavía no hay compromiso.",
  comprometido: "Acuerdo en firme (orden de compra, promesa de donación) sin movimiento de dinero.",
  ejecutado: "El dinero ya se pagó o ya se recibió.",
};

/**
 * Categorías de gastos e ingresos. `kind` fija a qué tipo pertenece cada una.
 * Los aportes de las personas voluntarias no se registran aquí: se calculan
 * solos a partir del estado del aporte en cada ficha.
 */
export const FINANCE_CATEGORIES = [
  { value: "transporte", label: "Transporte y fletes", kind: "gasto" },
  { value: "alimentacion", label: "Alimentación y agua", kind: "gasto" },
  { value: "alojamiento", label: "Alojamiento", kind: "gasto" },
  { value: "materiales", label: "Materiales de construcción", kind: "gasto" },
  { value: "herramientas", label: "Herramientas y equipos", kind: "gasto" },
  { value: "salud", label: "Salud, seguros y botiquín", kind: "gasto" },
  { value: "comunicaciones", label: "Comunicaciones y energía", kind: "gasto" },
  { value: "actividades", label: "Actividades con la comunidad", kind: "gasto" },
  { value: "administrativo", label: "Administrativo y bancario", kind: "gasto" },
  { value: "imprevistos", label: "Imprevistos", kind: "gasto" },
  { value: "otros_gastos", label: "Otros gastos", kind: "gasto" },
  { value: "donaciones", label: "Donaciones", kind: "ingreso" },
  { value: "patrocinios", label: "Patrocinios y empresas", kind: "ingreso" },
  { value: "recaudacion", label: "Eventos de recaudación", kind: "ingreso" },
  { value: "aportes_extra", label: "Aportes adicionales de voluntarios", kind: "ingreso" },
  { value: "otros_ingresos", label: "Otros ingresos", kind: "ingreso" },
] as const satisfies readonly (Option & { kind: FinanceKind })[];

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number]["value"];

export function financeCategoriesFor(kind: FinanceKind) {
  return FINANCE_CATEGORIES.filter((c) => c.kind === kind);
}

export function financeCategoryKind(category: string): FinanceKind | null {
  return FINANCE_CATEGORIES.find((c) => c.value === category)?.kind ?? null;
}

export const MISSION_STATUS = [
  { value: "planificacion", label: "En planificación" },
  { value: "convocatoria", label: "Convocatoria abierta" },
  { value: "en_curso", label: "En curso" },
  { value: "cerrada", label: "Cerrada" },
] as const satisfies readonly Option[];

export type DocType = (typeof DOC_TYPES)[number]["value"];
export type BloodType = (typeof BLOOD_TYPES)[number]["value"];
export type Attendance = (typeof ATTENDANCE)[number]["value"];
export type Role = (typeof ROLES)[number]["value"];
export type Skill = (typeof SKILLS)[number]["value"];
export type RegistrationStatus = (typeof REGISTRATION_STATUS)[number]["value"];
export type MissionStatus = (typeof MISSION_STATUS)[number]["value"];
export type UserRole = (typeof USER_ROLES)[number]["value"];
export type PaymentStatus = (typeof PAYMENT_STATUS)[number]["value"];

export function values<T extends string>(opts: readonly Option<T>[]): [T, ...T[]] {
  return opts.map((o) => o.value) as [T, ...T[]];
}

export function labelOf(opts: readonly Option[], value: string | null | undefined): string {
  if (!value) return "";
  return opts.find((o) => o.value === value)?.label ?? value;
}
