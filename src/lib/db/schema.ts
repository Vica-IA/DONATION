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

/** Grupos misioneros / organizaciones aliadas (Grupo Kairós, Fundación Pálpitos, ...). */
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

/** Misiones de campo (p. ej. Misión Levantar Chocó, 9–12 oct 2026). */
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
  /** Aporte económico por persona en COP (informativo; cláusula 30). */
  contributionAmount: integer("contribution_amount"),
  /** Condiciones de participación (markdown) que cada persona confirmada debe aceptar. */
  termsMarkdown: text("terms_markdown"),
  /** Casillas de aceptación, una por línea. */
  termsDeclarations: text("terms_declarations").notNull().default(""),
  /** Sube cuando el documento cambie de fondo: obliga a aceptar de nuevo. */
  termsVersion: integer("terms_version").notNull().default(1),
  /** Preguntar autorización de uso de imagen (SÍ / NO) al aceptar. */
  termsImageConsent: integer("terms_image_consent", { mode: "boolean" }).notNull().default(true),
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
    emergencyContactRelationship: text("emergency_contact_relationship"),
    emergencyContactPhone2: text("emergency_contact_phone2"),
    yellowFeverVaccineDate: text("yellow_fever_vaccine_date"), // YYYY-MM-DD
    accidentInsurance: text("accident_insurance"), // aseguradora / póliza
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
    paymentStatus: text("payment_status").notNull().default("pendiente"), // PAYMENT_STATUS
    paymentAmount: integer("payment_amount"), // COP
    paymentNotes: text("payment_notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("registrations_mission_volunteer_idx").on(t.missionId, t.volunteerId),
    index("registrations_status_idx").on(t.missionId, t.status),
  ],
);

/** Aceptación de las condiciones de participación por una persona (evidencia). */
export const termsAcceptances = sqliteTable(
  "terms_acceptances",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id),
    registrationId: text("registration_id")
      .notNull()
      .references(() => missionRegistrations.id),
    volunteerId: text("volunteer_id")
      .notNull()
      .references(() => volunteers.id),
    termsVersion: integer("terms_version").notNull(),
    documentHash: text("document_hash").notNull(), // sha256 del texto aceptado
    declarations: text("declarations").notNull(), // JSON con las casillas marcadas
    imageConsent: integer("image_consent", { mode: "boolean" }), // null si no se preguntó
    signedName: text("signed_name").notNull(),
    signedDocNumber: text("signed_doc_number").notNull(),
    signedCity: text("signed_city").notNull(),
    userAgent: text("user_agent"),
    acceptedAt: text("accepted_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [index("terms_acceptances_registration_idx").on(t.registrationId, t.termsVersion)],
);

/** Usuarios del panel (equipo). Cada uno tiene correo, contraseña propia y rol. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(), // siempre en minúsculas
  name: text("name").notNull(),
  role: text("role").notNull().default("consulta"), // USER_ROLES
  /** Líder de grupo: organización que lidera. */
  organizationId: text("organization_id").references(() => organizations.id),
  /** Coordinador de área: área que coordina (catálogo AREAS). */
  area: text("area"),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  passwordChangedAt: text("password_changed_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  lastLoginAt: text("last_login_at"),
  ...timestamps,
});

/** Tareas de preparación y campo, por misión y área (alimentan Resumen, Áreas y Tablero). */
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id),
    area: text("area").notNull().default("general"), // AREAS | 'general'
    title: text("title").notNull(),
    notes: text("notes"),
    ownerUserId: text("owner_user_id").references(() => users.id),
    dueDate: text("due_date"), // YYYY-MM-DD
    status: text("status").notNull().default("pendiente"), // TASK_STATUS
    isGoCriteria: integer("is_go_criteria", { mode: "boolean" }).notNull().default(false),
    completedAt: text("completed_at"),
    createdBy: text("created_by"),
    ...timestamps,
  },
  (t) => [index("tasks_mission_idx").on(t.missionId, t.area), index("tasks_owner_idx").on(t.ownerUserId)],
);

/** Movimientos financieros de una misión: presupuesto (proyectado), compromisos y ejecución. */
export const financeEntries = sqliteTable(
  "finance_entries",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id),
    kind: text("kind").notNull(), // FINANCE_KINDS
    status: text("status").notNull().default("proyectado"), // FINANCE_STATUS
    category: text("category").notNull(), // FINANCE_CATEGORIES
    area: text("area"), // AREAS | 'general' | null
    concept: text("concept").notNull(),
    amount: integer("amount").notNull(), // COP, sin decimales
    entryDate: text("entry_date"), // YYYY-MM-DD (fecha real o prevista)
    counterparty: text("counterparty"), // proveedor, donante, entidad
    reference: text("reference"), // factura, recibo, comprobante
    ownerUserId: text("owner_user_id").references(() => users.id),
    notes: text("notes"),
    createdBy: text("created_by"),
    ...timestamps,
  },
  (t) => [index("finance_mission_idx").on(t.missionId, t.kind, t.status), index("finance_category_idx").on(t.missionId, t.category)],
);

/** Bitácora mínima de actividad (principio de trazabilidad). */
export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(), // registration | mission | volunteer
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  actor: text("actor").notNull().default("sistema"), // nombre del usuario del panel | 'publico' | 'sistema'
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export type Organization = typeof organizations.$inferSelect;
export type Mission = typeof missions.$inferSelect;
export type Volunteer = typeof volunteers.$inferSelect;
export type MissionRegistration = typeof missionRegistrations.$inferSelect;
export type ActivityEntry = typeof activityLog.$inferSelect;
export type FinanceEntry = typeof financeEntries.$inferSelect;
export type User = typeof users.$inferSelect;
export type TermsAcceptance = typeof termsAcceptances.$inferSelect;
export type Task = typeof tasks.$inferSelect;
