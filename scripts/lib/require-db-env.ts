/**
 * Guardarraíl para los scripts que ESCRIBEN en la base de datos.
 *
 * El problema que resuelve: los ficheros `.env*` están gitignorados y no tienen rama.
 * Hay uno por entorno y se eligen a mano, así que nada impide lanzar contra producción
 * un script pensado para testing. El ref del proyecto Supabase que imprimen los scripts
 * ayuda, pero exige que alguien se pare a leerlo.
 *
 * Aquí cada fichero de entorno se autodeclara con `DB_ENV` y el script dice contra qué
 * entornos acepta correr. Si no coinciden, aborta antes de escribir nada.
 *
 * Falla cerrado a propósito: sin `DB_ENV` definido también aborta. Un `.env` antiguo que
 * no lo declare no debe colarse por defecto.
 */

/** Los cinco entornos. Cada `.env.*` declara el suyo en `DB_ENV`. */
export type DbEnv = "local" | "test" | "testing" | "academic" | "production";

const VALID: readonly DbEnv[] = [
  "local",
  "test",
  "testing",
  "academic",
  "production",
];

function isDbEnv(value: string): value is DbEnv {
  return (VALID as readonly string[]).includes(value);
}

/**
 * Declarada como `function` y no como arrow en un `const`: TypeScript solo usa el tipo
 * de retorno `never` para estrechar el flujo cuando es una declaración de función.
 */
function abort(expected: readonly DbEnv[], reason: string): never {
  console.error(`\n  ✗ ABORTADO: ${reason}`);
  console.error(`    Este script solo puede correr contra: ${expected.join(", ")}`);
  console.error(`    Carga el entorno correcto y vuelve a intentarlo, por ejemplo:`);
  console.error(`      set -a && . ./.env.${expected[0]} && set +a\n`);
  process.exit(1);
}

/**
 * Aborta el proceso si el entorno cargado no es uno de los esperados.
 * Devuelve el entorno detectado, para que el script pueda usarlo (por ejemplo en el
 * nombre de un fichero de salida).
 *
 *   const env = requireDbEnv("testing", "academic");
 */
export function requireDbEnv(...expected: DbEnv[]): DbEnv {
  const raw = (process.env.DB_ENV ?? "").trim();

  if (raw === "") {
    abort(
      expected,
      "no hay ningún DB_ENV definido, así que no se sabe contra qué base de datos " +
        "estás trabajando."
    );
  }

  if (!isDbEnv(raw)) {
    abort(expected, `DB_ENV="${raw}" no es un entorno conocido (${VALID.join(", ")}).`);
  }

  if (!expected.includes(raw)) {
    abort(expected, `el entorno cargado es "${raw}".`);
  }

  return raw;
}
