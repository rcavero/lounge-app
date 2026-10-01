import { AdminPageSkeleton } from "../../components/page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Reservas del evento"
      backHref="/admin/reservas"
      body="detail"
    />
  );
}
