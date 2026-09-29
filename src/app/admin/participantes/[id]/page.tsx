import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRegistration } from "@/lib/data";

/** Ruta antigua: la ficha vive dentro de su misión. */
export default async function LegacyParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/admin/participantes/${id}`);
  const detail = await getRegistration(id);
  if (!detail) notFound();
  redirect(`/admin/m/${detail.mission.id}/voluntarios/${id}`);
}
