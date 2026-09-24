import { AdminPageSkeleton } from "../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Administrar Reservas"
      subtitle="Selecciona un evento para ver sus reservas"
      backHref="/admin"
      body="list"
    />
  );
}
