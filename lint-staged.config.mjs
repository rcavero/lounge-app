/**
 * Qué corre el hook de pre-commit sobre los ficheros que se están commiteando.
 *
 * Los dos comandos de cada entrada corren **en orden**, no a la vez: Prettier primero
 * (formato) y ESLint después (reglas). Al revés, ESLint arreglaría cosas que Prettier
 * volvería a tocar.
 *
 * ESLint solo se aplica a `.ts`/`.tsx`. Los ficheros de configuración `.mjs`/`.mts` se
 * formatean pero no se lintan: las reglas de aquí son las de una aplicación Next, y
 * sobre un fichero de config no dicen nada útil.
 *
 * @type {import("lint-staged").Configuration}
 */
const config = {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
  "*.{mts,mjs,js,jsx,json,css}": ["prettier --write"],
};

export default config;
