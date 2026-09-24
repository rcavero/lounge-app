import { AdminPageSkeleton } from "../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Configurar Asientos"
      subtitle="Arrastra los asientos para posicionarlos"
      backHref="/admin"
      body="plan"
    />
  );
}
