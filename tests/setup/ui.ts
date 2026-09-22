/**
 * `setupFiles` del proyecto `ui`: desmonta el DOM entre tests.
 *
 * Testing Library se limpia sola cuando el runner expone sus globales, y aquí no los
 * expone: los tests importan `describe`/`it`/`expect` de `vitest` explícitamente, sin
 * `globals: true`. Sin este fichero, cada `render()` se acumula en el mismo `document`
 * y un `getByText` empieza a encontrar dos nodos donde debería haber uno.
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
