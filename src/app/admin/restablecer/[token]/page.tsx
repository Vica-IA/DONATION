import Link from "next/link";
import { Logo } from "@/components/brand";
import { formatDateTime } from "@/lib/format";
import { findActiveReset } from "@/lib/password-reset";
import { ResetForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nueva contraseña" };

/** Página pública (sin sesión) que abre el enlace generado por un administrador. */
export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const active = await findActiveReset(token);

  return (
    <main className="container-narrow flex flex-1 flex-col items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          {active ? (
            <>
              <h1 className="text-lg font-semibold">Crea tu nueva contraseña</h1>
              <p className="mb-4 mt-1 text-sm text-muted">
                Hola, {active.user.name}. Este enlace es para la cuenta <span className="font-semibold text-ink">{active.user.email}</span> y vence el{" "}
                {formatDateTime(active.expiresAt)}.
              </p>
              <ResetForm token={token} />
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Este enlace ya no sirve</h1>
              <p className="mb-4 mt-1 text-sm text-muted">No es válido, ya se usó o venció. Pide a un administrador del panel que te genere uno nuevo.</p>
              <Link href="/admin/login" className="btn-secondary w-full">
                Ir al acceso
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
