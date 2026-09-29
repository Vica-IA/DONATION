/** Detecta violaciones de índice único aunque el error venga envuelto (Drizzle → libSQL). */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    const message = current instanceof Error ? current.message : String(current);
    if (/UNIQUE|SQLITE_CONSTRAINT/i.test(message)) return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
