import { describe, expect, it, vi } from "vitest";
import {
  diasHasta,
  edad,
  formatearAutor,
  formatearCuit,
  formatearDni,
  formatearFecha,
  nombreCompleto,
  soloDigitos,
} from "./formato";

describe("identificadores", () => {
  it("formatea el CUIT que el backend devuelve sin guiones", () => {
    expect(formatearCuit("20345678901")).toBe("20-34567890-1");
  });

  it("devuelve el valor tal cual si no tiene 11 dígitos", () => {
    expect(formatearCuit("123")).toBe("123");
  });

  it("no rompe con valores vacíos", () => {
    expect(formatearCuit(null)).toBe("");
    expect(formatearDni(undefined)).toBe("");
  });

  it("agrupa el DNI de a miles", () => {
    expect(formatearDni("34567890")).toBe("34.567.890");
    expect(formatearDni("1234567")).toBe("1.234.567");
  });

  it("soloDigitos deja el CUIT como lo espera el backend", () => {
    expect(soloDigitos("20-34567890-1")).toBe("20345678901");
    expect(soloDigitos("  20 3456 7890 1 ")).toBe("20345678901");
  });
});

describe("fechas", () => {
  it("da vuelta la fecha ISO sin pasar por Date", () => {
    // Construir un Date con "1989-04-12" lo interpreta en UTC y en Argentina
    // puede mostrar el día anterior. Por eso se parte el string.
    expect(formatearFecha("1989-04-12")).toBe("12/04/1989");
    expect(formatearFecha("1989-04-12T00:00:00-03:00")).toBe("12/04/1989");
  });

  it("no rompe con entradas inválidas", () => {
    expect(formatearFecha("")).toBe("");
    expect(formatearFecha("cualquier cosa")).toBe("cualquier cosa");
  });

  it("calcula la edad descontando el cumpleaños no cumplido", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 1)); // 1 de marzo de 2026
    expect(edad("1989-04-12")).toBe(36); // todavía no cumplió
    expect(edad("1989-01-12")).toBe(37); // ya cumplió
    vi.useRealTimers();
  });

  it("cuenta los días que faltan para un plazo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 5));
    expect(diasHasta("2026-09-08")).toBe(3);
    expect(diasHasta("2026-09-01")).toBe(-4);
    expect(diasHasta(null)).toBeNull();
    vi.useRealTimers();
  });
});

describe("traza de auditoría", () => {
  it("traduce el formato interno del backend", () => {
    // El backend guarda "EMPLEADO:42:RESPONSABLE_AREA"; mostrarlo crudo no le
    // dice nada a nadie.
    expect(formatearAutor("EMPLEADO:42:RESPONSABLE_AREA")).toBe(
      "Empleado #42 · responsable area",
    );
    expect(formatearAutor("CIUDADANO:3:PERSONA")).toBe("Titular #3 · persona");
  });

  it("muestra un guión cuando no hay traza", () => {
    expect(formatearAutor(null)).toBe("—");
  });
});

describe("nombreCompleto", () => {
  it("une nombre y apellido sin espacios de más", () => {
    expect(nombreCompleto({ nombre: "Ana", apellido: "Pérez" })).toBe("Ana Pérez");
    expect(nombreCompleto({ nombre: "Ana" })).toBe("Ana");
    expect(nombreCompleto(null)).toBe("");
  });
});
