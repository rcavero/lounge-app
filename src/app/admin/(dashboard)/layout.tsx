import { redirect } from "next/navigation";
import { getSessionData } from "@/modules/auth/actions";
import { AdminHeader } from "./components/admin-header";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionData();

  // El middleware solo mira que la cookie diga «conectado». Aquí se comprueba contra la
  // base (RCA-286, R1): un usuario borrado, o con la contraseña cambiada, sale al login.
  if (!session.isLoggedIn) redirect("/admin/login");

  return (
    <>
      <AdminHeader email={session.email} />
      {children}
    </>
  );
}
