export const dynamic = "force-dynamic";

/** Las páginas del panel se envuelven en (shell) o m/[missionId]; el login no. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
