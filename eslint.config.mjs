import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Cliente generado por Prisma: no es código que escribamos ni que podamos arreglar.
  globalIgnores(["src/generated/**"]),
  // Informes que generan las herramientas de test: HTML y JS que no escribimos.
  globalIgnores(["coverage/**", "playwright-report/**", "test-results/**"]),
  {
    name: "tests",
    files: ["**/*.test.ts", "**/*.test.tsx", "tests/**/*.ts"],
    rules: {
      /**
       * En un test, un `<a href="/eventos/1">` es el dato de entrada del componente
       * que se está probando, no una navegación real de la aplicación. Sustituirlo por
       * `<Link>` metería el router de Next en un test de jsdom a cambio de nada.
       */
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
