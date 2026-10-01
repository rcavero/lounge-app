import { describe, expect, it } from "vitest";

import {
  CUSTOMER_NAME_MAX_LENGTH,
  CUSTOMER_NAME_MIN_LENGTH,
  displayCustomerName,
  normalizeCustomerName,
  validateCustomerName,
} from "./customer-name";

// Construidos desde el código y no pegados en el fuente: un carácter invisible o una
// marca bidireccional literal en un .ts es justo lo que este módulo existe para filtrar,
// y GitHub marca el fichero como sospechoso ("hidden bidirectional Unicode").
const cp = (code: number) => String.fromCodePoint(code);

const ZERO_WIDTH_SPACE = cp(0x200b);
const ZERO_WIDTH_NON_JOINER = cp(0x200c);
const BYTE_ORDER_MARK = cp(0xfeff);
const SOFT_HYPHEN = cp(0x00ad);
const BELL = cp(0x0007);
const RIGHT_TO_LEFT_OVERRIDE = cp(0x202e);
const LEFT_TO_RIGHT_MARK = cp(0x200e);
const RIGHT_TO_LEFT_MARK = cp(0x200f);
const LEFT_TO_RIGHT_ISOLATE = cp(0x2066);
const POP_DIRECTIONAL_ISOLATE = cp(0x2069);
const COMBINING_ACUTE_ACCENT = cp(0x0301);

// Visibles, pero se confunden a simple vista con su versión Latin-1.
const LEFT_SINGLE_QUOTE = cp(0x2018);
const RIGHT_SINGLE_QUOTE = cp(0x2019);
const ACUTE_ACCENT = cp(0x00b4);
const EN_DASH = cp(0x2013);
const EM_DASH = cp(0x2014);

/** El camino real: el modal y la server action siempre normalizan antes de validar. */
function check(raw: unknown) {
  return validateCustomerName(normalizeCustomerName(raw));
}

describe("normalizeCustomerName", () => {
  it("devuelve cadena vacía para cualquier cosa que no sea un string", () => {
    // La server action recibe lo que mande el navegador: no hay tipos en el cable.
    expect(normalizeCustomerName(undefined)).toBe("");
    expect(normalizeCustomerName(null)).toBe("");
    expect(normalizeCustomerName(123)).toBe("");
    expect(normalizeCustomerName({ name: "Ana" })).toBe("");
  });

  it("recorta y colapsa los espacios", () => {
    expect(normalizeCustomerName("  Ana   María \t López \n")).toBe("Ana María López");
  });

  it("recompone en NFC una tilde que llega descompuesta", () => {
    // "e" + acento combinante es lo que envían algunos teclados de macOS. Sin NFC, el
    // acento suelto no está en la lista blanca y el nombre se rechazaría.
    const nfd = `Jose${COMBINING_ACUTE_ACCENT}`;
    expect(nfd).toHaveLength(5);

    const normalized = normalizeCustomerName(nfd);
    expect(normalized).toBe("José");
    expect(normalized).toHaveLength(4);
    expect(check(nfd)).toBeNull();
  });

  it("elimina los caracteres invisibles", () => {
    expect(normalizeCustomerName(`A${ZERO_WIDTH_SPACE}n${ZERO_WIDTH_NON_JOINER}a`)).toBe(
      "Ana",
    );
    expect(normalizeCustomerName(`${BYTE_ORDER_MARK}Ana`)).toBe("Ana");
    expect(normalizeCustomerName(`An${SOFT_HYPHEN}a`)).toBe("Ana");
    expect(normalizeCustomerName(`Ana${BELL}`)).toBe("Ana");
  });

  it("elimina las marcas bidireccionales", () => {
    // El override invierte el sentido de lo que viene detrás: es lo que permite que en
    // el listado del panel un nombre se lea distinto de como está guardado.
    expect(normalizeCustomerName(`${RIGHT_TO_LEFT_OVERRIDE}anA`)).toBe("anA");
    expect(normalizeCustomerName(`Ana${LEFT_TO_RIGHT_MARK}${RIGHT_TO_LEFT_MARK}`)).toBe(
      "Ana",
    );
    expect(
      normalizeCustomerName(`${LEFT_TO_RIGHT_ISOLATE}Ana${POP_DIRECTIONAL_ISOLATE}`),
    ).toBe("Ana");
  });

  it("sustituye las comillas tipográficas por el apóstrofo Latin-1", () => {
    expect(normalizeCustomerName(`O${RIGHT_SINGLE_QUOTE}Brien`)).toBe("O'Brien");
    expect(normalizeCustomerName(`O${LEFT_SINGLE_QUOTE}Brien`)).toBe("O'Brien");
    expect(normalizeCustomerName("O`Brien")).toBe("O'Brien");
    expect(normalizeCustomerName(`O${ACUTE_ACCENT}Brien`)).toBe("O'Brien");
  });

  it("sustituye los guiones largos por el guion Latin-1", () => {
    expect(normalizeCustomerName(`Ana${EN_DASH}María`)).toBe("Ana-María");
    expect(normalizeCustomerName(`Ana${EM_DASH}María`)).toBe("Ana-María");
  });
});

describe("validateCustomerName — longitud", () => {
  it("los límites son 2 y 24", () => {
    // Si alguien cambia las constantes, los casos de abajo dejan de medir la frontera.
    expect(CUSTOMER_NAME_MIN_LENGTH).toBe(2);
    expect(CUSTOMER_NAME_MAX_LENGTH).toBe(24);
  });

  it("rechaza 0 y 1 caracteres", () => {
    expect(validateCustomerName("")).toBe("length");
    expect(validateCustomerName("A")).toBe("length");
  });

  it("acepta 2 caracteres", () => {
    expect(validateCustomerName("Al")).toBeNull();
  });

  it("acepta 24 caracteres y rechaza 25", () => {
    // 24 es lo que cabe en una línea de los 80 mm del ticket.
    expect(validateCustomerName("A".repeat(24))).toBeNull();
    expect(validateCustomerName("A".repeat(25))).toBe("length");
  });

  it("comprueba la longitud antes que los caracteres", () => {
    // Un nombre largo y con caracteres prohibidos se rechaza por largo. Es el motivo
    // que ve el cliente en el modal, así que el orden es observable.
    expect(validateCustomerName("@".repeat(30))).toBe("length");
  });
});

describe("validateCustomerName — caracteres", () => {
  it.each([
    ["tildes y eñe", "José Ñúñez"],
    ["diéresis", "Müller"],
    ["cedilla", "François"],
    ["apóstrofo", "O'Brien"],
    ["guion", "Ana-María"],
    ["punto", "J. García"],
    ["dígitos", "Mesa 12"],
  ])("acepta %s: %s", (_label, name) => {
    expect(validateCustomerName(name)).toBeNull();
  });

  it.each([
    ["un emoji", "Ana 🍺"],
    ["una arroba", "ana@bar"],
    ["un guion bajo", "ana_lopez"],
    ["griego", "Ελένη"],
    ["chino", "李小龍"],
    ["cirílico", "Иван"],
    ["el signo de multiplicar, que está en Latin-1 pero no es una letra", "Ana × 2"],
    ["una comilla tipográfica sin normalizar", `O${RIGHT_SINGLE_QUOTE}Brien`],
  ])('rechaza %s con "chars"', (_label, name) => {
    expect(validateCustomerName(name)).toBe("chars");
  });
});

describe("normalizar y después validar", () => {
  it("un nombre de 30 caracteres que queda en 24 tras normalizar es válido", () => {
    // Es lo que justifica el orden: validar el texto crudo rechazaría a un cliente
    // cuyo nombre, tal como se va a guardar, es perfectamente válido.
    const name = "Ana María López Ferreras";
    expect(name).toHaveLength(24);

    // Seis espacios de ancho cero repartidos: 30 caracteres, 6 de ellos invisibles.
    const z = ZERO_WIDTH_SPACE;
    const raw = `${z}Ana${z} María${z} López${z} Ferr${z}eras${z}`;
    expect(raw).toHaveLength(30);

    expect(validateCustomerName(raw)).toBe("length");
    expect(normalizeCustomerName(raw)).toBe(name);
    expect(check(raw)).toBeNull();
  });

  it("un nombre que tras normalizar sigue pasándose del límite se rechaza", () => {
    expect(check(`${"A".repeat(25)}${ZERO_WIDTH_SPACE}`)).toBe("length");
  });

  it("un nombre hecho solo de invisibles queda vacío y se rechaza por longitud", () => {
    const raw = ZERO_WIDTH_SPACE.repeat(3) + RIGHT_TO_LEFT_OVERRIDE;
    expect(normalizeCustomerName(raw)).toBe("");
    expect(check(raw)).toBe("length");
  });
});

describe("displayCustomerName", () => {
  it('pinta como "Sin nombre" el placeholder de las reservas antiguas', () => {
    expect(displayCustomerName("Cliente")).toBe("Sin nombre");
    expect(displayCustomerName("  Cliente  ")).toBe("Sin nombre");
  });

  it('pinta como "Sin nombre" lo que llega vacío', () => {
    expect(displayCustomerName(null)).toBe("Sin nombre");
    expect(displayCustomerName(undefined)).toBe("Sin nombre");
    expect(displayCustomerName("")).toBe("Sin nombre");
    expect(displayCustomerName("   ")).toBe("Sin nombre");
  });

  it("deja pasar un nombre real, recortado", () => {
    expect(displayCustomerName("  Ana  ")).toBe("Ana");
  });

  it("solo reconoce el placeholder exacto", () => {
    // Un cliente que se llame así en minúsculas, o "Clientes", es un nombre real.
    expect(displayCustomerName("cliente")).toBe("cliente");
    expect(displayCustomerName("Clientes")).toBe("Clientes");
  });
});
