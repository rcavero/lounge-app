/**
 * Cabeceras de seguridad (RCA-286, R5): ni la web pública ni el login del panel se pueden
 * incrustar en otra página. Van en todas las rutas; se comprueban en estas dos.
 */
import { expect, test } from "@playwright/test";

const EXPECTED = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

test.use({ storageState: { cookies: [], origins: [] } });

for (const path of ["/", "/admin/login"]) {
  test(`${path} lleva las cabeceras de seguridad`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()).toMatchObject(EXPECTED);
  });
}
