import { redirect } from "next/navigation";

/** Ruta anterior de edición: ahora la actividad se edita en el panel lateral del programa. */
export default async function ItemRedirect({ params }: { params: Promise<{ missionId: string; itemId: string }> }) {
  const { missionId, itemId } = await params;
  redirect(`/admin/m/${missionId}/programa?editar=${encodeURIComponent(itemId)}`);
}
