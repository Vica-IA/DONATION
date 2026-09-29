import { z } from "zod";
import {
  ATTENDANCE,
  AVAILABILITY,
  BLOOD_TYPES,
  DOC_TYPES,
  MISSION_STATUS,
  REGISTRATION_STATUS,
  ROLES,
  SHIRT_SIZES,
  SKILLS,
  TRANSPORT,
  values,
} from "./catalogs";

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
  organizationId: z.string().trim().max(64).optional().default(""),
  organizationOther: optionalText(80),
  eps: optionalText(80),
  bloodType: z.union([z.enum(values(BLOOD_TYPES)), z.literal("")]).transform((v) => (v === "" ? null : v)),
  emergencyContactName: trimmed(120).min(3, "Indica un contacto de emergencia"),
  emergencyContactPhone: phone,
  medicalNotes: optionalText(600),
  dietaryNotes: optionalText(300),
  shirtSize: z.union([z.enum(values(SHIRT_SIZES)), z.literal("")]).transform((v) => (v === "" ? null : v)),
  skills: z.array(z.enum(values(SKILLS))).max(SKILLS.length).default([]),
  constructionExperience: z.boolean().default(false),
  attendance: z.enum(values(ATTENDANCE), { message: "Indica si confirmas tu participación" }),
  availability: z.enum(values(AVAILABILITY), { message: "Indica tu disponibilidad" }),
  availabilityNotes: optionalText(300),
  transport: z.enum(values(TRANSPORT), { message: "Indica cómo llegarás" }),
  preferredRole: z.union([z.enum(values(ROLES)), z.literal("")]).transform((v) => (v === "" ? null : v)),
  comments: optionalText(800),
  dataConsent: z.literal(true, { message: "Debes autorizar el tratamiento de tus datos" }),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const adminRegistrationSchema = z.object({
  status: z.enum(values(REGISTRATION_STATUS)),
  assignedRole: z.union([z.enum(values(ROLES)), z.literal("")]).transform((v) => (v === "" ? null : v)),
  adminNotes: optionalText(2000),
  fullName: trimmed(120).min(3, "Nombre requerido"),
  phone,
  email: z
    .union([z.string().trim().email("Correo inválido").max(120), z.literal("")])
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  organizationId: z.string().trim().max(64).optional().default(""),
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
  })
  .refine((m) => m.endDate >= m.startDate, {
    message: "La fecha de fin debe ser igual o posterior a la de inicio",
    path: ["endDate"],
  });

export type MissionInput = z.infer<typeof missionSchema>;

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
