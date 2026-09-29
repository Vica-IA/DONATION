/**
 * Firmado/verificación del token de sesión con Web Crypto.
 * No importa nada de Node ni de la base de datos: se usa también en proxy.ts.
 *
 * Formato: v2.<userId>.<iat>.<exp>.<firma>
 * La validez real (usuario activo, contraseña no cambiada después de iat)
 * la comprueba src/lib/auth.ts contra la base de datos.
 */

export const SESSION_COOKIE = "donation_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 días

const DEV_SECRET = "donation-dev-secret-cambiar-en-produccion";
const encoder = new TextEncoder();

export type SessionClaims = { userId: string; iat: number; exp: number };

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/** Secreto de firma: AUTH_SECRET (obligatorio en producción). */
export function authSecret(): string | null {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV !== "production") return DEV_SECRET;
  return null;
}

export async function createSessionToken(userId: string): Promise<string | null> {
  const secret = authSecret();
  if (!secret) return null;
  const iat = Math.floor(Date.now() / 1000);
  const payload = `v2.${userId}.${iat}.${iat + SESSION_TTL_SECONDS}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v2") return null;
  const [, userId, iatRaw, expRaw, signature] = parts;
  const iat = Number(iatRaw);
  const exp = Number(expRaw);
  if (!userId || !Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  const secret = authSecret();
  if (!secret) return null;
  const expected = await hmac(secret, `v2.${userId}.${iatRaw}.${expRaw}`);
  return timingSafeEqual(expected, signature) ? { userId, iat, exp } : null;
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
