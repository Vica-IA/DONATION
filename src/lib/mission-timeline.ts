/** Línea de tiempo genérica de una misión, calculada a partir de sus fechas. */

export type PhaseState = "past" | "current" | "future";
export type Phase = { key: string; name: string; start: string; end: string; state: PhaseState };

export type MissionTimeline = {
  today: string;
  /** Días que faltan para la salida (0 si ya empezó). */
  daysLeft: number;
  status: "antes" | "campo" | "despues";
  /** Día de misión (1..n) cuando está en campo. */
  dayOfMission: number | null;
  phaseName: string;
  phases: Phase[];
  /** Texto corto para la barra lateral: "Salida en 10 días", "En campo · día 2", "Finalizada". */
  badge: string;
};

export function todayBogota(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function missionTimeline(mission: { startDate: string; endDate: string; createdAt?: string }, today = todayBogota()): MissionTimeline {
  const start = mission.startDate;
  const end = mission.endDate;
  const created = mission.createdAt ? mission.createdAt.slice(0, 10) : addDays(start, -30);
  const prepStart = created < addDays(start, -7) ? created : addDays(start, -30);

  const defs: Omit<Phase, "state">[] = [
    { key: "preparacion", name: "Preparación", start: prepStart, end: addDays(start, -7) },
    { key: "predespliegue", name: "Pre-despliegue", start: addDays(start, -6), end: addDays(start, -4) },
    { key: "cierre", name: "Cierre operativo", start: addDays(start, -3), end: addDays(start, -1) },
    { key: "campo", name: "Misión de campo", start, end },
    { key: "post", name: "Post-misión (72 h)", start: addDays(end, 1), end: addDays(end, 3) },
  ];

  const phases: Phase[] = defs.map((p) => ({
    ...p,
    state: today > p.end ? "past" : today < p.start ? "future" : "current",
  }));
  let current = phases.find((p) => p.state === "current");
  if (!current) {
    // Antes de la preparación o después del cierre: marcar la más cercana.
    current = today < start ? phases[0] : phases[phases.length - 1];
    current.state = "current";
  }

  const status: MissionTimeline["status"] = today < start ? "antes" : today > end ? "despues" : "campo";
  const daysLeft = status === "antes" ? diffDays(today, start) : 0;
  const dayOfMission = status === "campo" ? diffDays(start, today) + 1 : null;
  const badge =
    status === "antes" ? (daysLeft === 1 ? "Salida mañana" : `Salida en ${daysLeft} días`) : status === "campo" ? `En campo · día ${dayOfMission}` : "Misión finalizada";

  return { today, daysLeft, status, dayOfMission, phaseName: current.name, phases, badge };
}
