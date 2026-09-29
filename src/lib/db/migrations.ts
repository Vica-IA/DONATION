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
];
