export const APP_NAME = "DONATO";
export const APP_TAGLINE = "De la donación al impacto.";
export const APP_DESCRIPTION =
  "Plataforma de gestión, trazabilidad e impacto para misiones y ayuda humanitaria.";

/** URL pública del sitio, usada para construir enlaces compartibles. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
