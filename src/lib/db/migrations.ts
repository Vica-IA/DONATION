/**
 * Migraciones versionadas en SQL plano. Se aplican al arrancar la app
 * (ver ./index.ts) y se registran en la tabla _migrations, por lo que son
 * idempotentes. Para cambiar el esquema: agrega una nueva entrada al final,
 * nunca edites una ya aplicada en producción.
 */
export const MIGRATIONS: { id: string; statements: string[] }[] = [
  {
    id: "0001_initial",
    statements: [
      `CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        location TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 40,
        status TEXT NOT NULL DEFAULT 'convocatoria',
        registration_open INTEGER NOT NULL DEFAULT 1,
        meeting_point TEXT,
        contact_name TEXT,
        contact_phone TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE TABLE IF NOT EXISTS volunteers (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        doc_number TEXT NOT NULL,
        birth_date TEXT,
        phone TEXT NOT NULL,
        email TEXT,
        city TEXT,
        organization_id TEXT REFERENCES organizations(id),
        organization_other TEXT,
        eps TEXT,
        blood_type TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        medical_notes TEXT,
        dietary_notes TEXT,
        shirt_size TEXT,
        skills TEXT NOT NULL DEFAULT '[]',
        construction_experience INTEGER NOT NULL DEFAULT 0,
        data_consent INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS volunteers_doc_idx ON volunteers (doc_type, doc_number)`,
      `CREATE INDEX IF NOT EXISTS volunteers_org_idx ON volunteers (organization_id)`,
      `CREATE TABLE IF NOT EXISTS mission_registrations (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        volunteer_id TEXT NOT NULL REFERENCES volunteers(id),
        status TEXT NOT NULL DEFAULT 'pendiente',
        attendance TEXT NOT NULL,
        availability TEXT NOT NULL DEFAULT 'completa',
        availability_notes TEXT,
        transport TEXT NOT NULL DEFAULT 'grupo',
        preferred_role TEXT,
        assigned_role TEXT,
        comments TEXT,
        admin_notes TEXT,
        confirmed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS registrations_mission_volunteer_idx ON mission_registrations (mission_id, volunteer_id)`,
      `CREATE INDEX IF NOT EXISTS registrations_status_idx ON mission_registrations (mission_id, status)`,
      `CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT,
        actor TEXT NOT NULL DEFAULT 'sistema',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
    ],
  },
  {
    id: "0002_users",
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'consulta',
        password_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        password_changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        last_login_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
    ],
  },
  {
    id: "0003_terms_and_payments",
    statements: [
      `ALTER TABLE missions ADD COLUMN contribution_amount INTEGER`,
      `ALTER TABLE missions ADD COLUMN terms_markdown TEXT`,
      `ALTER TABLE missions ADD COLUMN terms_declarations TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE missions ADD COLUMN terms_version INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE missions ADD COLUMN terms_image_consent INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE volunteers ADD COLUMN emergency_contact_relationship TEXT`,
      `ALTER TABLE volunteers ADD COLUMN emergency_contact_phone2 TEXT`,
      `ALTER TABLE volunteers ADD COLUMN yellow_fever_vaccine_date TEXT`,
      `ALTER TABLE volunteers ADD COLUMN accident_insurance TEXT`,
      `ALTER TABLE mission_registrations ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pendiente'`,
      `ALTER TABLE mission_registrations ADD COLUMN payment_amount INTEGER`,
      `ALTER TABLE mission_registrations ADD COLUMN payment_notes TEXT`,
      `CREATE TABLE IF NOT EXISTS terms_acceptances (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        registration_id TEXT NOT NULL REFERENCES mission_registrations(id),
        volunteer_id TEXT NOT NULL REFERENCES volunteers(id),
        terms_version INTEGER NOT NULL,
        document_hash TEXT NOT NULL,
        declarations TEXT NOT NULL,
        image_consent INTEGER,
        signed_name TEXT NOT NULL,
        signed_doc_number TEXT NOT NULL,
        signed_city TEXT NOT NULL,
        user_agent TEXT,
        accepted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE INDEX IF NOT EXISTS terms_acceptances_registration_idx ON terms_acceptances (registration_id, terms_version)`,
    ],
  },
  {
    id: "0004_roles_scope_and_tasks",
    statements: [
      `ALTER TABLE users ADD COLUMN organization_id TEXT REFERENCES organizations(id)`,
      `ALTER TABLE users ADD COLUMN area TEXT`,
      `ALTER TABLE users ADD COLUMN phone TEXT`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        area TEXT NOT NULL DEFAULT 'general',
        title TEXT NOT NULL,
        notes TEXT,
        owner_user_id TEXT REFERENCES users(id),
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'pendiente',
        is_go_criteria INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE INDEX IF NOT EXISTS tasks_mission_idx ON tasks (mission_id, area)`,
      `CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks (owner_user_id)`,
    ],
  },
  {
    id: "0005_finance_entries",
    statements: [
      `CREATE TABLE IF NOT EXISTS finance_entries (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'proyectado',
        category TEXT NOT NULL,
        area TEXT,
        concept TEXT NOT NULL,
        amount INTEGER NOT NULL,
        entry_date TEXT,
        counterparty TEXT,
        reference TEXT,
        owner_user_id TEXT REFERENCES users(id),
        notes TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE INDEX IF NOT EXISTS finance_mission_idx ON finance_entries (mission_id, kind, status)`,
      `CREATE INDEX IF NOT EXISTS finance_category_idx ON finance_entries (mission_id, category)`,
    ],
  },
  {
    id: "0006_password_resets",
    statements: [
      `CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id)`,
    ],
  },
  {
    id: "0007_app_settings",
    statements: [
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
    ],
  },
  {
    id: "0008_volunteer_refugio",
    statements: [`ALTER TABLE volunteers ADD COLUMN refugio TEXT`],
  },
  {
    id: "0009_mission_schedule",
    statements: [
      `ALTER TABLE missions ADD COLUMN departure_note TEXT`,
      `ALTER TABLE missions ADD COLUMN return_note TEXT`,
      // Misión inicial: retirar la descripción provisional y cargar salida y llegada (una sola vez).
      `UPDATE missions SET description = NULL WHERE code = 'CHO-2026-01' AND description LIKE 'Primera misión de campo de DONATION%'`,
      `UPDATE missions SET departure_note = 'Viernes 9 de octubre, 6:00 p. m.', return_note = 'Lunes 12 de octubre, 11:00 p. m.' WHERE code = 'CHO-2026-01' AND departure_note IS NULL AND return_note IS NULL`,
    ],
  },
  {
    id: "0010_program_announcements_squads",
    statements: [
      `CREATE TABLE IF NOT EXISTS itinerary_items (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        day TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        title TEXT NOT NULL,
        place TEXT,
        area TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE INDEX IF NOT EXISTS itinerary_mission_idx ON itinerary_items (mission_id, day, start_time)`,
      `CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE INDEX IF NOT EXISTS announcements_mission_idx ON announcements (mission_id, created_at)`,
      `CREATE TABLE IF NOT EXISTS squads (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        name TEXT NOT NULL,
        area TEXT,
        leader_registration_id TEXT,
        meeting_point TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE INDEX IF NOT EXISTS squads_mission_idx ON squads (mission_id)`,
      `ALTER TABLE mission_registrations ADD COLUMN squad_id TEXT`,
    ],
  },
];
