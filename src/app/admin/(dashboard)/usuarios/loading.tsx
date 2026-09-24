import { AdminPageSkeleton } from "../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Administrar Usuarios"
      subtitle="Gestiona los usuarios del sistema"
      backHref="/admin"
      body="list"
    />
  );
}
