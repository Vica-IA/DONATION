import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/brand";

export default function NotFound() {
  return (
    <>
      <PublicHeader />
      <main className="container-narrow flex flex-1 flex-col items-center justify-center py-20 text-center">
        <p className="text-6xl font-black text-brand-600">404</p>
        <h1 className="mt-3 text-xl font-semibold">Esta página no existe</h1>
        <p className="mt-2 text-sm text-slate-500">Revisa el enlace o vuelve al inicio.</p>
        <Link href="/" className="btn-primary mt-6">
          Ir al inicio
        </Link>
      </main>
      <PublicFooter />
    </>
  );
}
