import { describe, expect, it } from "vitest";
import { comparar, normalizar } from "./texto";

describe("normalizar", () => {
  it("hace que buscar sin acentos encuentre igual", () => {
    // Sin esto, buscar "perez" en el padrón no encuentra a Pérez, que es el
    // caso más común en castellano.
    expect(normalizar("Pérez")).toBe("perez");
    expect(normalizar("PEÑA")).toBe("pena");
    expect(normalizar("  Gómez  ")).toBe("gomez");
  });

  it("no rompe con valores vacíos", () => {
    expect(normalizar(null)).toBe("");
    expect(normalizar(undefined)).toBe("");
    expect(normalizar(123)).toBe("123");
  });
});

describe("comparar", () => {
  it("ordena números como números y no como texto", () => {
    // Ordenando como texto, "10" iría antes que "9".
    expect(comparar(9, 10)).toBeLessThan(0);
    expect(comparar("9", "10")).toBeLessThan(0);
  });

  it("ordena texto con las reglas del castellano", () => {
    expect(comparar("ánimo", "banana")).toBeLessThan(0);
    expect(comparar("Zapata", "alvarez")).toBeGreaterThan(0);
  });

  it("manda los valores vacíos al final", () => {
    expect(comparar(null, "algo")).toBeGreaterThan(0);
    expect(comparar("algo", null)).toBeLessThan(0);
    expect(comparar(null, null)).toBe(0);
  });
});
