import { describe, expect, it } from "vitest";
import { MAX_FANTASMAS, elegirFantasmas, planDelSalto, velocidadDeBezier } from "./planSalto";

const pixeles = (k) => Number(k.filter.match(/blur\(([\d.]+)px\)/)[1]);

describe("planDelSalto", () => {
  it("entre vecinas es el empujón corto, sin desenfoque", () => {
    const plan = planDelSalto(0);
    expect(plan).toMatchObject({ fantasmas: 0, pantallas: 1, ms: 520, desenfoque: [] });
    expect(plan.curva).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
  });

  it("cada sección del medio alarga el recorrido y el tiempo", () => {
    expect(planDelSalto(1)).toMatchObject({ fantasmas: 1, pantallas: 2, ms: 680 });
    expect(planDelSalto(2)).toMatchObject({ fantasmas: 2, pantallas: 3, ms: 760 });
  });

  it("nunca dibuja más de tres fantasmas", () => {
    expect(planDelSalto(7)).toMatchObject({ fantasmas: MAX_FANTASMAS, ms: 840 });
  });

  it("el desenfoque es nulo en los extremos y tiene el pico en el medio", () => {
    const { desenfoque } = planDelSalto(3);
    const valores = desenfoque.map(pixeles);
    expect(valores[0]).toBe(0);
    expect(valores.at(-1)).toBe(0);
    /* 6px de base más 3 por fantasma. */
    expect(Math.max(...valores)).toBe(15);
    expect(desenfoque[0].offset).toBe(0);
    expect(desenfoque.at(-1).offset).toBe(1);
  });
});

describe("elegirFantasmas", () => {
  it("si entran todas, van todas y en orden", () => {
    expect(elegirFantasmas(["a", "b"])).toEqual(["a", "b"]);
  });

  it("si sobran, se reparten con la primera y la última siempre", () => {
    expect(elegirFantasmas(["a", "b", "c", "d", "e"])).toEqual(["a", "c", "e"]);
  });

  it("con lugar para una sola, la vecina del origen", () => {
    expect(elegirFantasmas(["a", "b", "c"], 1)).toEqual(["a"]);
  });
});

describe("velocidadDeBezier", () => {
  it("una curva lineal va a velocidad constante", () => {
    const v = velocidadDeBezier([0, 0, 1, 1]);
    expect(v(0.25)).toBeCloseTo(1, 3);
    expect(v(0.75)).toBeCloseTo(1, 3);
  });

  it("una que arranca quieta tiene velocidad cero al principio", () => {
    expect(velocidadDeBezier([0.5, 0, 0.1, 1])(0)).toBeCloseTo(0, 6);
  });
});
