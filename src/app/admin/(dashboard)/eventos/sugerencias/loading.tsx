import { AdminPageSkeleton } from "../../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Sugerencias de Partidos"
      backHref="/admin/eventos"
      body="list"
    />
  );
}
