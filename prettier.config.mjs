/**
 * Configuración de Prettier.
 *
 * Solo se cambia una cosa respecto a los valores por defecto, y por un motivo concreto:
 * el código de este repositorio ya está escrito a ~90 columnas (de 10.700 líneas, 265
 * pasan de 90 pero solo 140 pasan de 100). Con el `printWidth` por defecto de 80,
 * Prettier volvería a partir 661 líneas que hoy se leen bien, y el primer commit tras
 * adoptarlo sería ilegible.
 *
 * La adopción fue gradual hasta P6: el hook de pre-commit formateaba solo lo que se
 * tocaba, para que el ruido de formato no se mezclara con cambios reales. Al llegar el
 * CI, que comprueba el repositorio entero, el resto se formateó en un único commit que
 * solo formatea (ver `.git-blame-ignore-revs`).
 *
 * `endOfLine: "auto"`: en Windows, con `core.autocrlf`, la copia de trabajo tiene CRLF y
 * el repositorio LF. Con el valor por defecto (`"lf"`), `format:check` marcaba en local
 * todos los ficheros por el salto de línea; en el runner de Linux no pasaba. Con `auto`
 * cada fichero conserva el suyo y la comprobación dice lo mismo en las dos máquinas.
 *
 * @type {import("prettier").Config}
 */
const config = {
  printWidth: 90,
  endOfLine: "auto",
};

export default config;
