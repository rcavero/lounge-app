import { AdminPageSkeleton } from "../../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Editar Evento"
      subtitle="Modifica los detalles del partido"
      backHref="/admin/eventos"
      body="form"
    />
  );
}
