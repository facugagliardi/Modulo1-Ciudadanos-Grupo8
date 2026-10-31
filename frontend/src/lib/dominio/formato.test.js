import { describe, expect, it, vi } from "vitest";
import {
  diasHasta,
  edad,
  formatearAutor,
  formatearCuit,
  formatearDni,
  formatearFecha,
  formatearFechaHora,
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

  it("tolera identificadores ausentes o todavía sin normalizar", () => {
    expect(soloDigitos(undefined)).toBe("");
    expect(formatearDni("sin documento")).toBe("sin documento");
  });
});

describe("fechas", () => {
  it("muestra hora local y conserva entradas inválidas sin romper la pantalla", () => {
    expect(formatearFechaHora("2026-03-01T14:05:00-03:00")).toBe("01/03/2026 14:05");
    expect(formatearFechaHora(null)).toBe("");
    expect(formatearFechaHora("fecha inválida")).toBe("fecha inválida");
  });

  it("cumple años el día exacto y no muestra edades de fechas futuras o ausentes", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 2, 12));
      expect(edad("1989-03-12")).toBe(37);
      expect(edad("1989-03-13")).toBe(36);
      expect(edad("2027-01-01")).toBeNull();
      expect(edad(undefined)).toBeNull();
      expect(edad("inválida")).toBeNull();
      expect(diasHasta("inválida")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
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
  it("muestra trazas antiguas sin rol y conserva textos sin identificador", () => {
    expect(formatearAutor("EMPLEADO:42")).toBe("Empleado #42");
    expect(formatearAutor("EMPLEADO:42:")).toBe("Empleado #42");
    expect(formatearAutor("sistema")).toBe("sistema");
  });
  it("traduce el formato interno del backend", () => {
    // El backend guarda "EMPLEADO:42:RESPONSABLE_AREA"; mostrarlo crudo no le
    // dice nada a nadie.
    expect(formatearAutor("EMPLEADO:42:RESPONSABLE_AREA")).toBe(
      "Empleado #42 · responsable area",
    );
    expect(formatearAutor("CIUDADANO:3:PERSONA")).toBe("Titular #3 · ciudadano");
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
