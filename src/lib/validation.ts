import { z } from "zod";
import {
  ATTENDANCE,
  BLOOD_TYPES,
  DOC_TYPES,
  MISSION_STATUS,
  PAYMENT_STATUS,
  REGISTRATION_STATUS,
  ROLES,
  SKILLS,
  AREAS,
  FINANCE_CATEGORIES,
  FINANCE_KINDS,
  FINANCE_STATUS,
  TASK_STATUS,
  financeCategoryKind,
  USER_ROLES,
  values,
} from "./catalogs";

export const PASSWORD_MIN_LENGTH = 8;

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v));

const phone = z
  .string()
  .trim()
  .min(7, "Escribe un teléfono válido")
  .max(30)
  .regex(/^[+\d\s().-]+$/, "Solo números, espacios y el signo +");

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");

export const registrationSchema = z.object({
  fullName: trimmed(120).min(3, "Escribe tu nombre completo"),
  docType: z.enum(values(DOC_TYPES), { message: "Selecciona el tipo de documento" }),
  docNumber: trimmed(40)
    .min(4, "Escribe tu número de documento")
    .transform((v) => v.replace(/[\s.-]/g, "").toUpperCase()),
  birthDate: z.union([isoDate, z.literal("")]).transform((v) => (v === "" ? null : v)),
  phone,
  email: z
    .union([z.string().trim().email("Correo inválido").max(120), z.literal("")])
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  city: optionalText(80),
  organizationId: z.string().trim().min(1, "Elige tu grupo").max(64),
  refugio: optionalText(80),
  eps: optionalText(80),
  bloodType: z.union([z.enum(values(BLOOD_TYPES)), z.literal("")]).transform((v) => (v === "" ? null : v)),
  emergencyContactName: trimmed(120).min(3, "Indica un contacto de emergencia"),
  emergencyContactPhone: phone,
  emergencyContactRelationship: optionalText(60),
  emergencyContactPhone2: z
    .union([phone, z.literal("")])
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
  accidentInsurance: optionalText(120),
  medicalNotes: optionalText(600),
  dietaryNotes: optionalText(300),
  skills: z.array(z.enum(values(SKILLS))).max(SKILLS.length).default([]),
  constructionExperience: z.boolean().default(false),
  attendance: z.enum(values(ATTENDANCE), { message: "Indica si confirmas tu participación" }),
  preferredRole: z.union([z.enum(values(ROLES)), z.literal("")]).transform((v) => (v === "" ? null : v)),
  comments: optionalText(800),
  termsAccepted: z.literal(true, { message: "Debes aceptar las condiciones de participación para enviar el formulario" }),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const adminRegistrationSchema = z.object({
  status: z.enum(values(REGISTRATION_STATUS)),
  assignedRole: z.union([z.enum(values(ROLES)), z.literal("")]).transform((v) => (v === "" ? null : v)),
  adminNotes: optionalText(2000),
  paymentStatus: z.enum(values(PAYMENT_STATUS)),
  paymentAmount: z
    .union([z.coerce.number().int().min(0).max(100_000_000), z.literal("")])
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
  paymentNotes: optionalText(300),
  fullName: trimmed(120).min(3, "Nombre requerido"),
  phone,
  email: z
    .union([z.string().trim().email("Correo inválido").max(120), z.literal("")])
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  organizationId: z.string().trim().max(64).optional().default(""),
  refugio: optionalText(80),
});

export const missionSchema = z
  .object({
    name: trimmed(120).min(3, "Nombre requerido"),
    code: trimmed(40)
      .min(3, "Código requerido")
      .transform((v) => v.toUpperCase()),
    slug: trimmed(60)
      .min(3, "Identificador de URL requerido")
      .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
    description: optionalText(1500),
    location: optionalText(200),
    startDate: isoDate,
    endDate: isoDate,
    capacity: z.coerce.number().int().min(1, "Mínimo 1").max(10000),
    status: z.enum(values(MISSION_STATUS)),
    registrationOpen: z.boolean().default(false),
    meetingPoint: optionalText(200),
    contactName: optionalText(120),
    contactPhone: optionalText(30),
    contributionAmount: z
      .union([z.coerce.number().int().min(0).max(100_000_000), z.literal("")])
      .optional()
      .transform((v) => (v === undefined || v === "" ? null : v)),
    termsMarkdown: z
      .string()
      .max(200_000, "El documento es demasiado largo")
      .optional()
      .transform((v) => (v === undefined || v.trim() === "" ? null : v.replace(/\r\n/g, "\n"))),
    termsDeclarations: z
      .string()
      .max(20_000)
      .optional()
      .transform((v) =>
        (v ?? "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .join("\n"),
      ),
    termsVersion: z.coerce.number().int().min(1, "Mínimo 1").max(1000),
    termsImageConsent: z.boolean().default(false),
  })
  .refine((m) => m.endDate >= m.startDate, {
    message: "La fecha de fin debe ser igual o posterior a la de inicio",
    path: ["endDate"],
  });

export type MissionInput = z.infer<typeof missionSchema>;

/** Aceptación por enlace personal (nueva versión del documento): una sola casilla. */
export const termsAcceptanceSchema = z.object({
  accepted: z.literal(true, { message: "Debes marcar la casilla para aceptar las condiciones." }),
});

const email = z.string().trim().toLowerCase().email("Correo inválido").max(120);
const password = z.string().min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`).max(200);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Escribe tu contraseña").max(200),
});

const scopeFields = {
  phone: z
    .union([phone, z.literal("")])
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
  role: z.enum(values(USER_ROLES), { message: "Selecciona un rol" }),
  organizationId: z.string().trim().max(64).optional().default(""),
  area: z.union([z.enum(values(AREAS)), z.literal("")]).optional().default(""),
};

/** Un líder necesita grupo; un coordinador necesita área. Los demás no llevan alcance. */
function normalizeScope<T extends { role: string; organizationId: string; area: string }>(d: T) {
  return {
    ...d,
    organizationId: d.role === "lider_grupo" ? d.organizationId || null : null,
    area: d.role === "coordinador" && d.area ? (d.area as (typeof AREAS)[number]["value"]) : null,
  };
}
const scopeRefine = [
  (d: { role: string; organizationId: string | null }) => d.role !== "lider_grupo" || Boolean(d.organizationId),
  { message: "Selecciona el grupo que lidera", path: ["organizationId"] as (string | number)[] },
] as const;
const areaRefine = [
  (d: { role: string; area: string | null }) => d.role !== "coordinador" || Boolean(d.area),
  { message: "Selecciona el área que coordina", path: ["area"] as (string | number)[] },
] as const;

export const userCreateSchema = z
  .object({
    name: trimmed(120).min(2, "Nombre requerido"),
    email,
    ...scopeFields,
    // Vacío = se genera una contraseña temporal automáticamente.
    password: z.union([password, z.literal("")]).transform((v) => (v === "" ? null : v)),
  })
  .transform(normalizeScope)
  .refine(...scopeRefine)
  .refine(...areaRefine);

export const userUpdateSchema = z
  .object({
    name: trimmed(120).min(2, "Nombre requerido"),
    ...scopeFields,
    active: z.boolean().default(false),
  })
  .transform(normalizeScope)
  .refine(...scopeRefine)
  .refine(...areaRefine);

export const taskSchema = z.object({
  title: trimmed(160).min(3, "Escribe el nombre de la tarea"),
  area: z.union([z.enum(values(AREAS)), z.literal("general")]),
  ownerUserId: z.string().trim().max(64).optional().default(""),
  dueDate: z
    .union([isoDate, z.literal("")])
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
  status: z.enum(values(TASK_STATUS)).default("pendiente"),
  isGoCriteria: z.boolean().default(false),
  notes: optionalText(600),
});

export type TaskInput = z.infer<typeof taskSchema>;

/** Valor en pesos: admite "1.500.000", "1,500,000" o "1500000"; sin decimales. */
const copAmount = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[^\d-]/g, "") : v),
  z.coerce
    .number({ message: "Escribe el valor en pesos" })
    .int("Sin decimales")
    .min(1, "El valor debe ser mayor que cero")
    .max(100_000_000_000, "Valor demasiado alto"),
);

export const financeEntrySchema = z
  .object({
    kind: z.enum(values(FINANCE_KINDS), { message: "Indica si es gasto o ingreso" }),
    status: z.enum(values(FINANCE_STATUS)).default("proyectado"),
    category: z.enum(values(FINANCE_CATEGORIES), { message: "Selecciona una categoría" }),
    area: z
      .union([z.enum(values(AREAS)), z.literal("general"), z.literal("")])
      .optional()
      .transform((v) => (v === undefined || v === "" ? null : v)),
    concept: trimmed(160).min(3, "Describe el movimiento"),
    amount: copAmount,
    entryDate: z
      .union([isoDate, z.literal("")])
      .optional()
      .transform((v) => (v === undefined || v === "" ? null : v)),
    counterparty: optionalText(120),
    reference: optionalText(80),
    ownerUserId: z.string().trim().max(64).optional().default(""),
    notes: optionalText(600),
  })
  .refine((d) => financeCategoryKind(d.category) === d.kind, { message: "La categoría no corresponde al tipo de movimiento", path: ["category"] });

export type FinanceEntryInput = z.infer<typeof financeEntrySchema>;

export const passwordResetSchema = z.object({
  password: z.union([password, z.literal("")]).transform((v) => (v === "" ? null : v)),
});

/** Nueva contraseña desde un enlace de restablecimiento. */
export const resetWithTokenSchema = z
  .object({
    newPassword: password,
    confirmPassword: z.string().max(200),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Las contraseñas no coinciden", path: ["confirmPassword"] });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Escribe tu contraseña actual").max(200),
    newPassword: password,
    confirmPassword: z.string().max(200),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Las contraseñas no coinciden", path: ["confirmPassword"] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: "La nueva contraseña debe ser distinta", path: ["newPassword"] });

/** Convierte FormData en un objeto plano apto para zod (checkbox → boolean, multi → array). */
export function formToObject(formData: FormData, arrays: string[] = [], booleans: string[] = []) {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (arrays.includes(key)) {
      const list = (obj[key] as string[] | undefined) ?? [];
      list.push(value);
      obj[key] = list;
    } else {
      obj[key] = value;
    }
  }
  for (const key of arrays) obj[key] ??= [];
  for (const key of booleans) obj[key] = formData.get(key) === "on" || formData.get(key) === "true";
  return obj;
}

export type FieldErrors = Record<string, string>;

export function flattenErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
