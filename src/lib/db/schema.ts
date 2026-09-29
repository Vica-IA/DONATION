import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Esquema del MVP de DONATION (SQLite / libSQL).
 * Los cambios estructurales se aplican con migraciones en ./migrations.ts.
 */

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

/** Grupos misioneros / organizaciones aliadas (KAIROS Life, PALPITOS, ...). */
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

/** Misiones de campo (p. ej. Misión Chocó 01, 9–12 oct 2026). */
export const missions = sqliteTable("missions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // CHO-2026-01
  slug: text("slug").notNull().unique(), // choco-2026-01
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  capacity: integer("capacity").notNull().default(40),
  status: text("status").notNull().default("convocatoria"),
  registrationOpen: integer("registration_open", { mode: "boolean" }).notNull().default(true),
  meetingPoint: text("meeting_point"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  ...timestamps,
});

/** Personas voluntarias. Una persona existe una sola vez (por documento). */
export const volunteers = sqliteTable(
  "volunteers",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    docType: text("doc_type").notNull(),
    docNumber: text("doc_number").notNull(),
    birthDate: text("birth_date"),
    phone: text("phone").notNull(),
    email: text("email"),
    city: text("city"),
    organizationId: text("organization_id").references(() => organizations.id),
    organizationOther: text("organization_other"),
    eps: text("eps"),
    bloodType: text("blood_type"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    medicalNotes: text("medical_notes"),
    dietaryNotes: text("dietary_notes"),
    shirtSize: text("shirt_size"),
    skills: text("skills").notNull().default("[]"), // JSON array de catálogo SKILLS
    constructionExperience: integer("construction_experience", { mode: "boolean" })
      .notNull()
      .default(false),
    dataConsent: integer("data_consent", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("volunteers_doc_idx").on(t.docType, t.docNumber),
    index("volunteers_org_idx").on(t.organizationId),
  ],
);

/** Inscripción / confirmación de una persona a una misión. */
export const missionRegistrations = sqliteTable(
  "mission_registrations",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id),
    volunteerId: text("volunteer_id")
      .notNull()
      .references(() => volunteers.id),
    status: text("status").notNull().default("pendiente"), // REGISTRATION_STATUS
    attendance: text("attendance").notNull(), // respuesta literal de la persona
    availability: text("availability").notNull().default("completa"),
    availabilityNotes: text("availability_notes"),
    transport: text("transport").notNull().default("grupo"),
    preferredRole: text("preferred_role"),
    assignedRole: text("assigned_role"),
    comments: text("comments"), // comentarios de la persona
    adminNotes: text("admin_notes"), // notas internas del equipo
    confirmedAt: text("confirmed_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("registrations_mission_volunteer_idx").on(t.missionId, t.volunteerId),
    index("registrations_status_idx").on(t.missionId, t.status),
  ],
);

/** Bitácora mínima de actividad (principio de trazabilidad). */
export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(), // registration | mission | volunteer
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  actor: text("actor").notNull().default("sistema"), // 'admin' | 'publico' | 'sistema'
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export type Organization = typeof organizations.$inferSelect;
export type Mission = typeof missions.$inferSelect;
export type Volunteer = typeof volunteers.$inferSelect;
export type MissionRegistration = typeof missionRegistrations.$inferSelect;
export type ActivityEntry = typeof activityLog.$inferSelect;
