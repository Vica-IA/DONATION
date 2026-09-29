import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-core";

/**
 * Primera barrera para /admin: sin un token firmado y vigente, redirige al login.
 * Cada página y acción del panel vuelve a verificar con requireUser() /
 * requirePermission(), que además comprueban el usuario en la base de datos.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (claims) return NextResponse.next();
  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*"],
};
