import { AdminPageSkeleton } from "./components/page-skeleton";

/**
 * El panel principal y, además, la pantalla de carga de cualquier página del panel que
 * no tenga la suya. Por eso no lleva título: el menú es la forma más neutra.
 */
export default function Loading() {
  return <AdminPageSkeleton body="menu" />;
}
