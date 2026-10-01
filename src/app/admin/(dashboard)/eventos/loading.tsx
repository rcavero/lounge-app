import { AdminPageSkeleton } from "../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Configurar Eventos"
      subtitle="Crea o modifica un evento"
      backHref="/admin"
      body="list"
    />
  );
}
