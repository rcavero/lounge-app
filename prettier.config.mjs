/**
 * Configuración de Prettier.
 *
 * Solo se cambia una cosa respecto a los valores por defecto, y por un motivo concreto:
 * el código de este repositorio ya está escrito a ~90 columnas (de 10.700 líneas, 265
 * pasan de 90 pero solo 140 pasan de 100). Con el `printWidth` por defecto de 80,
 * Prettier volvería a partir 661 líneas que hoy se leen bien, y el primer commit tras
 * adoptarlo sería ilegible.
 *
 * La adopción es gradual: el hook de pre-commit formatea **lo que se toca**, no el
 * repositorio entero. Así el ruido de formato aparece solo en ficheros que ya iban a
 * salir en el diff.
 *
 * @type {import("prettier").Config}
 */
const config = {
  printWidth: 90,
};

export default config;
