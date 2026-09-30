"use client";

import { useEffect } from "react";

/**
 * Pantalla de error global. El caso más común en producción: la página quedó
 * abierta de un despliegue anterior y su formulario ya no existe en el servidor.
 * Recargar resuelve; el botón lo hace por la persona.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="container-narrow flex flex-1 flex-col items-center justify-center py-16">
      <div className="card w-full max-w-md text-center">
        <h1 className="text-lg font-semibold">Algo no salió bien</h1>
        <p className="mt-2 text-sm text-muted">
          Es probable que la aplicación se haya actualizado mientras tenías esta página abierta. Recárgala e intenta de nuevo; tus datos no se pierden.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Recargar la página
          </button>
          <button type="button" className="btn-secondary" onClick={() => reset()}>
            Reintentar
          </button>
        </div>
        {error.digest ? <p className="mt-3 text-xs text-faint">Referencia: {error.digest}</p> : null}
      </div>
    </main>
  );
}
