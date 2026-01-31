import { getSessionData } from "@/modules/auth/actions";
import { AdminHeader } from "./components/admin-header";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionData();

  return (
    <>
      <AdminHeader email={session.email} />
      {children}
    </>
  );
}
