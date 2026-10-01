import { AdminPageSkeleton } from "../../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Editar Usuario"
      subtitle="Modifica los datos del usuario"
      backHref="/admin/usuarios"
      body="form"
    />
  );
}
