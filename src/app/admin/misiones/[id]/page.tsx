import { redirect } from "next/navigation";

/** Ruta antigua: ahora la lista vive dentro de la misión. */
export default async function LegacyMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/m/${id}/voluntarios`);
}
