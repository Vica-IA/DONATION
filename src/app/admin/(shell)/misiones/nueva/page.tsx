import { PageBody, PageHeader } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { MissionForm } from "../mission-form";

export const metadata = { title: "Nueva misión" };

export default async function NewMissionPage() {
  await requirePermission("missions.manage", "/admin/misiones/nueva");
  return (
    <>
      <PageHeader kicker="Misiones" title="Nueva misión" />
      <PageBody>
        <div className="mx-auto w-full max-w-3xl">
          <MissionForm mission={null} />
        </div>
      </PageBody>
    </>
  );
}
