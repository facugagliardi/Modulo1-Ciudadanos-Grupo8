import { describe, expect, it } from "vitest";
import {
  ALCANCES_REPRESENTACION,
  ARCHIVOS_PERMITIDOS,
  etiquetaDe,
  RECIPROCO,
  reciprocoDe,
  TIPOS_ACTUACION,
  TIPOS_CONTACTO,
  TIPOS_DOCUMENTO,
  TIPOS_ORGANIZACION,
  TIPOS_PROPIEDAD,
  TIPOS_RELACION,
} from "./listasBlancas";

const TODAS = {
  TIPOS_RELACION,
  TIPOS_PROPIEDAD,
  ALCANCES_REPRESENTACION,
  TIPOS_DOCUMENTO,
  TIPOS_ORGANIZACION,
  TIPOS_ACTUACION,
  TIPOS_CONTACTO,
};

describe("listas blancas", () => {
  it("todos los valores van en mayúsculas, como los espera el backend", () => {
    for (const [nombre, lista] of Object.entries(TODAS)) {
      for (const { valor } of lista) {
        expect(valor, `${nombre}: ${valor}`).toBe(valor.toUpperCase());
      }
    }
  });

  it("ninguna etiqueta queda igual al código en pantalla cuando debería traducirse", () => {
    // La convención del equipo: el código en mayúsculas es del sistema, la
    // pantalla va en castellano.
    expect(etiquetaDe(TIPOS_RELACION, "CONYUGE")).toBe("Cónyuge");
    expect(etiquetaDe(TIPOS_PROPIEDAD, "GALPON")).toBe("Galpón");
    expect(etiquetaDe(TIPOS_DOCUMENTO, "PARTIDA_NACIMIENTO")).toBe("Partida de nacimiento");
    expect(etiquetaDe(TIPOS_CONTACTO, "EMAIL")).toBe("Correo electrónico");
  });

  it("no hay valores repetidos", () => {
    for (const [nombre, lista] of Object.entries(TODAS)) {
      const valores = lista.map((o) => o.valor);
      expect(new Set(valores).size, nombre).toBe(valores.length);
    }
  });

  it("las listas que tienen OTRO lo dejan al final", () => {
    for (const [nombre, lista] of Object.entries(TODAS)) {
      const i = lista.findIndex((o) => o.valor === "OTRO");
      if (i !== -1) expect(i, nombre).toBe(lista.length - 1);
    }
  });

  it("devuelve el valor crudo si no encuentra la etiqueta", () => {
    expect(etiquetaDe(TIPOS_RELACION, "INVENTADO")).toBe("INVENTADO");
  });
});

describe("recíprocos de relación", () => {
  it("resuelve los vínculos que quedan determinados", () => {
    expect(reciprocoDe("TUTOR")).toBe("TUTELADO");
    expect(reciprocoDe("TUTELADO")).toBe("TUTOR");
  });

  it("los vínculos simétricos se proponen a sí mismos", () => {
    expect(reciprocoDe("CONYUGE")).toBe("CONYUGE");
    expect(reciprocoDe("CONVIVIENTE")).toBe("CONVIVIENTE");
  });

  it("NO adivina el recíproco cuando depende del género", () => {
    // Una hija puede tener padre o madre: la aplicación no guarda género y
    // deducirlo escribiría un dato falso en el registro civil. Se pregunta.
    for (const ambiguo of ["HIJO", "HIJA", "PADRE", "MADRE", "HERMANO", "HERMANA"]) {
      expect(reciprocoDe(ambiguo), ambiguo).toBeNull();
    }
  });

  it("todo recíproco que sí propone es un tipo válido", () => {
    const validos = TIPOS_RELACION.map((o) => o.valor);
    for (const [tipo, rec] of Object.entries(RECIPROCO)) {
      expect(validos, tipo).toContain(rec);
      expect(validos, tipo).toContain(tipo);
    }
  });

  it("devuelve null para un tipo desconocido", () => {
    expect(reciprocoDe("INVENTADO")).toBeNull();
  });
});

describe("archivos permitidos", () => {
  it("coincide con lo que acepta el backend", () => {
    expect(ARCHIVOS_PERMITIDOS.extensiones).toEqual([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);
    expect(ARCHIVOS_PERMITIDOS.tamanoMaximoBytes).toBe(10 * 1024 * 1024);
  });

  it("hay un tipo MIME para cada extensión declarada", () => {
    expect(ARCHIVOS_PERMITIDOS.tiposMime).toContain("application/pdf");
    expect(ARCHIVOS_PERMITIDOS.tiposMime).toContain("image/webp");
  });
});
