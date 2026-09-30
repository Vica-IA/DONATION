const DATE_FMT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHORT_FMT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
const DATETIME_FMT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return DATE_FMT.format(new Date(`${iso}T00:00:00Z`));
}

/** "9 – 12 de octubre de 2026" para un rango de fechas. */
export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${s.getUTCDate()} – ${DATE_FMT.format(e)}`;
  }
  return `${SHORT_FMT.format(s)} – ${DATE_FMT.format(e)}`;
}

/** "2 oct" */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return SHORT_FMT.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "");
  return (first + last).toUpperCase();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return DATETIME_FMT.format(new Date(iso));
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export function nowIso(): string {
  return new Date().toISOString();
}

const COP_FMT = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function formatCOP(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  return COP_FMT.format(amount);
}

/** "18:00" → "6:00 p. m." */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

const WEEKDAY_FMT = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

/** "viernes, 9 de oct" */
export function formatWeekday(iso: string): string {
  return WEEKDAY_FMT.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");
}

/** Nombre corto para páginas públicas: "Juan Pérez Gómez" → "Juan P." */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName.trim();
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

/** Compara nombres sin tildes, mayúsculas ni espacios repetidos. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
