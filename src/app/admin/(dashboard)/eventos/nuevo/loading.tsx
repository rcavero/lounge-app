import { AdminPageSkeleton } from "../../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Nuevo Evento"
      subtitle="Configura los detalles del partido"
      backHref="/admin/eventos"
      body="form"
    />
  );
}
