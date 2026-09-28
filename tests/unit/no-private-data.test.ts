/**
 * Guardarraíl de publicación (RCA-275): ningún dato privado vuelve a entrar en el árbol.
 *
 * El repositorio se puede publicar. En septiembre de 2026 se quitaron del árbol el correo
 * de la propietaria, el código de comercio (FUC) de producción, claves y contraseñas; el
 * historial de git no se reescribió, por decisión del propietario del repo. Este test hace
 * que el próximo commit que los reintroduzca falle en `npm test` y en el CI.
 *
 * La lista negra va por HUELLA SHA-256, nunca en claro: si llevara los literales, este
 * propio fichero publicaría lo que quiere proteger. Por lo mismo, los fallos dicen el
 * fichero, la línea y el tipo de dato, pero no el valor.
 *
 * Recorre lo versionado y lo nuevo sin ignorar (`git ls-files --cached --others
 * --exclude-standard`), así que también avisa de un fichero que aún no se ha añadido.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Huellas SHA-256 de valores que no pueden aparecer, con qué es cada una. */
const DENYLIST = new Map<string, string>([
  [
    "25448ae71a70b33bd844b1506e14820a93e0c78cdc1626debc3a186e75e54d89",
    "FUC de producción",
  ],
  [
    "289fab6129a7073130588577800595760cb6bea5d27bd546ac231c880bafde68",
    "correo de la propietaria",
  ],
  [
    "cde468396357a5bf47056581fc74f0bfcf77b1db8410de2843abfb6ade020e21",
    "clave de football-data",
  ],
  [
    "ac6b366baebdc7841631049359345a18359c16febe120e9fe5c2962bc9cf4bca",
    "ref de Supabase (testing)",
  ],
  [
    "be12b1287648d90c1594945b92e750514578198dbbc89d2c3d09ff6627b0fb81",
    "ref de Supabase (producción)",
  ],
  [
    "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f",
    "contraseña del antiguo seed",
  ],
]);

/** Las formas que tienen esos valores. Cada coincidencia se pasa por la huella. */
const CANDIDATES = [
  /\b\d{8,9}\b/g, // FUC y contraseñas numéricas
  /\b[0-9a-f]{32}\b/g, // claves de API
  /\b[a-z]{20}\b/g, // refs de proyecto de Supabase
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // correos
];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Correos que sí pueden aparecer: el autor del repo, la firma de los commits y ejemplos. */
const ALLOWED_EMAILS = new Set(["ramoncaveroaras@gmail.com", "noreply@anthropic.com"]);
const ALLOWED_EMAIL_DOMAINS = new Set([
  "example.com",
  "ejemplo.com",
  "email.com",
  "lounge.com",
  "lounge.test",
]);

/** Ficheros retirados del árbol que no pueden volver, por nombre. */
const FORBIDDEN_PATHS = [/REUNION_SUSANA/i];

const BINARY = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|pdf|zip)$/i;
const SKIPPED = new Set(["package-lock.json"]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function trackedTextFiles(): string[] {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return output
    .split("\n")
    .filter(Boolean)
    .filter((file) => !BINARY.test(file) && !SKIPPED.has(file) && existsSync(file));
}

function isAllowedEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return ALLOWED_EMAILS.has(lower) || ALLOWED_EMAIL_DOMAINS.has(lower.split("@")[1]);
}

/** Los hallazgos de un texto, como `línea: tipo`, sin el valor. */
function findings(text: string): string[] {
  const found: string[] = [];
  text.split("\n").forEach((line, index) => {
    for (const pattern of CANDIDATES) {
      for (const match of line.matchAll(pattern)) {
        const kind = DENYLIST.get(sha256(match[0].toLowerCase()));
        if (kind) found.push(`${index + 1}: ${kind}`);
      }
    }
    for (const match of line.matchAll(EMAIL)) {
      if (!isAllowedEmail(match[0]) && !DENYLIST.has(sha256(match[0].toLowerCase()))) {
        found.push(`${index + 1}: correo fuera de la lista blanca`);
      }
    }
  });
  return found;
}

describe("datos privados fuera del árbol", () => {
  it("el detector reconoce un valor de la lista negra y un correo desconocido", () => {
    // Autocomprobación con valores inventados: si la huella o las expresiones se rompen,
    // el test de abajo pasaría en verde sin mirar nada.
    DENYLIST.set(sha256("987654321"), "prueba");
    // Troceado para que este fichero no se delate a sí mismo en el test de abajo.
    const unknownEmail = ["alguien", "dominio-real.es"].join("@");
    try {
      expect(findings(`FUC \`987654321\`\nmail: ${unknownEmail}`)).toEqual([
        "1: prueba",
        "2: correo fuera de la lista blanca",
      ]);
      expect(findings("admin@example.com y 999008881")).toEqual([]);
    } finally {
      DENYLIST.delete(sha256("987654321"));
    }
  });

  it("ningún fichero lleva un dato de la lista negra ni un correo de un tercero", () => {
    const files = trackedTextFiles();
    expect(files.length).toBeGreaterThan(100);

    const problems = files.flatMap((file) =>
      findings(readFileSync(file, "utf8")).map((finding) => `${file}:${finding}`),
    );
    expect(problems).toEqual([]);
  });

  it("no vuelve ningún fichero retirado", () => {
    const files = trackedTextFiles();
    expect(files.filter((file) => FORBIDDEN_PATHS.some((re) => re.test(file)))).toEqual(
      [],
    );
  });
});
