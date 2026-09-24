import { AdminPageSkeleton } from "../../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Añadir Usuario"
      subtitle="Crea un nuevo usuario del sistema"
      backHref="/admin/usuarios"
      body="form"
    />
  );
}
