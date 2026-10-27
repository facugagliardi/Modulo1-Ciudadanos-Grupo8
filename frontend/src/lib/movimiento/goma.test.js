import { describe, expect, it } from "vitest";
import { motionValue } from "motion/react";
import { crearGoma } from "./goma";

const AJUSTE = { stretch: 40, squash: 2, speed: 1.85, reduce: false };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function armar(tramo) {
  const ini = motionValue(tramo.ini);
  const fin = motionValue(tramo.fin);
  return { ini, fin, goma: crearGoma(ini, fin) };
}

describe("crearGoma", () => {
  it("saltar deja el tramo en el destino, en seco", () => {
    const { ini, fin, goma } = armar({ ini: 0, fin: 40 });
    goma.saltar({ ini: 100, fin: 160 });
    expect([ini.get(), fin.get()]).toEqual([100, 160]);
  });

  it("con movimiento reducido, viajar también salta", () => {
    const { ini, fin, goma } = armar({ ini: 0, fin: 40 });
    goma.viajar({ ini: 0, fin: 40 }, { ini: 100, fin: 160 }, { ...AJUSTE, reduce: true });
    expect([ini.get(), fin.get()]).toEqual([100, 160]);
  });

  it("hacia adelante se estira sobre los dos tramos y termina en el nuevo", async () => {
    const { ini, fin, goma } = armar({ ini: 0, fin: 40 });
    let largoMaximo = 0;
    fin.on("change", () => (largoMaximo = Math.max(largoMaximo, fin.get() - ini.get())));

    goma.viajar({ ini: 0, fin: 40 }, { ini: 100, fin: 160 }, AJUSTE);
    await esperar(600);

    /* Más largo que cualquiera de los dos: en algún momento los cubrió a ambos. */
    expect(largoMaximo).toBeGreaterThan(60);
    expect(ini.get()).toBeCloseTo(100, 0);
    expect(fin.get()).toBeCloseTo(160, 0);
  });

  it("hacia atrás llega igual, y sin rebote también", async () => {
    const { ini, fin, goma } = armar({ ini: 100, fin: 160 });
    goma.viajar({ ini: 100, fin: 160 }, { ini: 0, fin: 40 }, { ...AJUSTE, squash: 0 });
    await esperar(600);
    expect(ini.get()).toBeCloseTo(0, 0);
    expect(fin.get()).toBeCloseTo(40, 0);
  });

  it("un viaje nuevo corta el anterior", async () => {
    const { ini, fin, goma } = armar({ ini: 0, fin: 40 });
    goma.viajar({ ini: 0, fin: 40 }, { ini: 100, fin: 160 }, AJUSTE);
    await esperar(40);
    goma.viajar({ ini: ini.get(), fin: fin.get() }, { ini: 200, fin: 240 }, AJUSTE);
    await esperar(600);
    expect(ini.get()).toBeCloseTo(200, 0);
    expect(fin.get()).toBeCloseTo(240, 0);
    goma.parar();
  });
});
