/**
 * Firmado/verificación de la sesión de administración con Web Crypto.
 * No importa nada de Node para poder usarse también desde proxy.ts.
 */

export const SESSION_COOKIE = "donation_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function secretKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await secretKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(sig);
}

/** Secreto de firma: AUTH_SECRET o, en su defecto, derivado de ADMIN_PASSWORD. */
export async function sessionSecret(): Promise<string | null> {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const password = adminPassword();
  if (!password) return null;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`donation-session:${password}`));
  return toBase64Url(digest);
}

/** Contraseña del panel. En desarrollo hay una por defecto; en producción es obligatoria. */
export function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV !== "production") return "donation2026";
  return null;
}

export async function createSessionToken(): Promise<string | null> {
  const secret = await sessionSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${exp}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const secret = await sessionSecret();
  if (!secret) return false;
  const expected = await hmac(secret, `${parts[0]}.${parts[1]}`);
  return timingSafeEqual(expected, parts[2]);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
