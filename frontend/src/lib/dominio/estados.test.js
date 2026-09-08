import { describe, expect, it } from "vitest";
import {
  destinosPosibles,
  ENTIDADES,
  esTerminal,
  etiquetaEstado,
  TRANSICIONES,
  valenciaDe,
} from "./estados";

describe("grafo de transiciones", () => {
  it("nunca ofrece el estado actual como destino", () => {
    // El backend rechaza con 400 mandar el estado que ya se tiene: no es
    // idempotente. Si el grafo lo ofreciera, el usuario vería ese error.
    for (const [entidad, mapa] of Object.entries(TRANSICIONES)) {
      for (const estado of Object.keys(mapa)) {
        expect(destinosPosibles(entidad, estado)).not.toContain(estado);
      }
    }
  });

  it("un ciudadano fallecido no admite ningún cambio", () => {
    expect(destinosPosibles(ENTIDADES.CIUDADANO, "FALLECIDO")).toEqual([]);
    expect(esTerminal(ENTIDADES.CIUDADANO, "FALLECIDO")).toBe(true);
  });

  it("un expediente iniciado no puede resolverse directamente", () => {
    const destinos = destinosPosibles(ENTIDADES.EXPEDIENTE, "INICIADO");
    expect(destinos).toContain("EN_TRAMITE");
    expect(destinos).toContain("ARCHIVADO");
    expect(destinos).not.toContain("RESUELTO");
  });

  it("una solicitud vencida todavía puede cumplirse fuera de plazo", () => {
    expect(destinosPosibles(ENTIDADES.SOLICITUD, "VENCIDA")).toEqual(["CUMPLIDA"]);
  });

  it("ninguna transición apunta a un estado que no existe en la entidad", () => {
    for (const [entidad, mapa] of Object.entries(TRANSICIONES)) {
      const conocidos = Object.keys(mapa);
      for (const destinos of Object.values(mapa)) {
        for (const d of destinos) {
          expect(conocidos, `${entidad} apunta a ${d}`).toContain(d);
        }
      }
    }
  });
});

describe("terminalidad derivada del grafo", () => {
  it("VENCIDA es terminal en una representación y no en una solicitud", () => {
    // Es la razón por la que la terminalidad se deriva y no se declara con
    // una lista de nombres de estado: el mismo nombre significa cosas
    // distintas según la entidad.
    expect(esTerminal(ENTIDADES.REPRESENTACION, "VENCIDA")).toBe(true);
    expect(esTerminal(ENTIDADES.SOLICITUD, "VENCIDA")).toBe(false);
  });

  it("ninguna organización tiene estado terminal", () => {
    for (const estado of ["ACTIVA", "INACTIVA", "BLOQUEADA"]) {
      expect(esTerminal(ENTIDADES.ORGANIZACION, estado)).toBe(false);
    }
  });
});

describe("valencia y etiquetas", () => {
  it("CUMPLIDA es positiva aunque sea terminal", () => {
    // El color codifica gravedad, no terminalidad: por eso CUMPLIDA va en
    // verde con el candado, y no en rojo.
    expect(valenciaDe("CUMPLIDA")).toBe("positiva");
    expect(esTerminal(ENTIDADES.SOLICITUD, "CUMPLIDA")).toBe(true);
  });

  it("los estados adversos son graves", () => {
    for (const e of ["FALLECIDO", "BLOQUEADO", "REVOCADA", "RECHAZADO"]) {
      expect(valenciaDe(e)).toBe("grave");
    }
  });

  it("un estado desconocido cae en neutra sin romper", () => {
    expect(valenciaDe("LO_QUE_SEA")).toBe("neutra");
    expect(etiquetaEstado("LO_QUE_SEA")).toBe("LO_QUE_SEA");
  });

  it("traduce los estados al castellano de pantalla", () => {
    expect(etiquetaEstado("EN_TRAMITE")).toBe("En trámite");
  });
});
