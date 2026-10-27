import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

/**
 * jsdom no pinta, así que el contexto 2D es un doble que anota lo que se dibuja,
 * y los huesos tienen medidas inventadas: sin eso no habría ni una celda.
 *
 * El módulo se importa de nuevo en cada prueba porque recuerda si hay canvas.
 */
let pintados;
/** Deja correr el tiempo de verdad —el mínimo, la ola, el barrido— adentro de `act`. */
const esperar = (ms) => act(() => new Promise((r) => setTimeout(r, ms)));

const contexto = () => ({
  setTransform() {},
  clearRect() {},
  fillRect: (x, y, w, h) => pintados.push({ x, y, w, h }),
  fillStyle: "",
  globalAlpha: 1,
});

function medidasFalsas() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function medir() {
    if (this.hasAttribute?.("data-hueso")) return { left: 10, top: 10, width: 70, height: 14 };
    /* Las piezas del molde de prueba, chicas y en una esquina: si midieran como
       la tarjeta la taparían entera y no quedaría fondo que pintar. */
    if (this.matches?.("svg, button, span[data-prueba]")) return { left: 150, top: 2, width: 20, height: 10 };
    return { left: 0, top: 0, width: 200, height: 40 };
  });
}

async function importar({ canvas = true, reducido = false } = {}) {
  vi.resetModules();
  HTMLCanvasElement.prototype.getContext = canvas ? contexto : () => null;
  window.matchMedia = vi.fn(() => ({ matches: reducido }));
  return import("./Esqueleto");
}

function Pantalla({ modulo, cargando }) {
  const { CargaConEsqueleto, Hueso } = modulo;
  return (
    <CargaConEsqueleto
      cargando={cargando}
      etiqueta="Cargando tus domicilios…"
      molde={<Hueso className="h-4 w-20" />}
    >
      <p>Calle Falsa 123</p>
    </CargaConEsqueleto>
  );
}

describe("CargaConEsqueleto", () => {
  beforeEach(() => {
    pintados = [];
    medidasFalsas();
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
    delete Range.prototype.getClientRects;
    delete window.matchMedia;
  });

  it("mientras carga anuncia la carga y no muestra el contenido", async () => {
    const modulo = await importar();
    render(<Pantalla modulo={modulo} cargando />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tus domicilios…");
    expect(screen.queryByText("Calle Falsa 123")).toBeNull();
  });

  it("pinta los cuadraditos adentro de los huesos y la ola los agranda", async () => {
    const modulo = await importar();
    render(<Pantalla modulo={modulo} cargando />);
    await esperar(300);

    expect(pintados.length).toBeGreaterThan(0);
    /* Un hueso de 70×14 en (10, 10): diez columnas y dos filas por cuadro. */
    for (const { x, y, w } of pintados) {
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x + w).toBeLessThanOrEqual(80);
      expect(y).toBeGreaterThanOrEqual(10);
    }
    const lados = new Set(pintados.map((p) => p.w));
    expect(Math.min(...lados)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...lados)).toBeLessThanOrEqual(6);
  });

  it("al llegar los datos se barre: el frente avanza y el contenido queda solo", async () => {
    const modulo = await importar();
    const { rerender, container } = render(<Pantalla modulo={modulo} cargando />);
    rerender(<Pantalla modulo={modulo} cargando={false} />);

    /* Hasta cumplir el mínimo, el esqueleto se queda. */
    expect(screen.getByRole("status")).toBeInTheDocument();

    const frentes = [];
    const caja = container.firstChild;
    const reloj = setInterval(() => {
      const f = caja.style.getPropertyValue("--frente");
      if (f && frentes.at(-1) !== f) frentes.push(parseFloat(f));
    }, 16);
    /* En dos tramos: `act` aplica los cambios de estado recién al cerrarse. El
       primero cumple el mínimo (650 ms) y larga el barrido; el segundo lo deja
       terminar (720 ms). */
    await esperar(800);
    await esperar(1100);
    clearInterval(reloj);

    expect(screen.getByText("Calle Falsa 123")).toBeInTheDocument();
    expect(container.querySelector("canvas")).toBeNull();

    expect(frentes.length).toBeGreaterThan(2);
    expect(frentes).toEqual([...frentes].sort((a, b) => a - b));
    expect(caja).not.toHaveClass("esq-barriendo");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("si el contenido es más bajo que el molde, la caja se achica de a poco", async () => {
    const modulo = await importar();
    /* El molde mide 120 de alto y el contenido 40: la caja pasa de uno al otro
       cuando arranca el barrido, y lo de abajo sube con ella. */
    const medir = Element.prototype.getBoundingClientRect.getMockImplementation();
    Element.prototype.getBoundingClientRect.mockImplementation(function medirCaja() {
      if (!this.classList?.contains("caja-prueba")) return medir.call(this);
      return { left: 0, top: 0, width: 200, height: this.classList.contains("esq-barriendo") ? 40 : 120 };
    });
    const animar = vi.fn(() => ({ cancel: vi.fn() }));
    Element.prototype.animate = animar;
    const { CargaConEsqueleto, Hueso } = modulo;
    const pantalla = (cargando) => (
      <CargaConEsqueleto cargando={cargando} className="caja-prueba" molde={<Hueso className="h-28" />}>
        <p>Calle Falsa 123</p>
      </CargaConEsqueleto>
    );
    const { rerender } = render(pantalla(true));
    rerender(pantalla(false));
    await esperar(800);

    const [keyframes, opciones] = animar.mock.calls[0];
    expect(keyframes.map((k) => k.height)).toEqual(["120px", "40px"]);
    /* Recorta mientras se achica: el esqueleto alto no se dibuja encima de lo de abajo. */
    expect(keyframes.every((k) => k.overflow === "clip")).toBe(true);
    expect(opciones.duration).toBeGreaterThan(0);
    delete Element.prototype.animate;
  });

  it("copia el layout del molde: las piezas van en cuadraditos y el marco queda", async () => {
    const modulo = await importar();
    /* jsdom no tiene `getClientRects` en los rangos: sin esto no habría renglones. */
    Range.prototype.getClientRects = () => [{ left: 10, top: 10, width: 60, height: 20 }];
    render(
      <modulo.CargaConEsqueleto
        cargando
        molde={
          <div
            data-prueba="tarjeta"
            style={{ border: "1px solid rgb(228, 225, 218)", backgroundColor: "rgb(255, 255, 255)" }}
          >
            <div data-prueba="cabecera" style={{ backgroundColor: "rgb(248, 247, 244)" }} />
            <svg data-prueba="icono" />
            <p data-prueba="titulo">Todavía no cargaste ninguno</p>
            <button type="button">Cargar mi domicilio</button>
            <span data-prueba="chip" style={{ display: "inline-flex", backgroundColor: "rgb(231, 237, 244)" }}>
              Principal
            </span>
            <span data-prueba="suelto">sin fondo</span>
          </div>
        }
      >
        <p>contenido</p>
      </modulo.CargaConEsqueleto>,
    );
    const pieza = (sel) => document.querySelector(sel).hasAttribute("data-esq-pieza");

    expect(pieza('[data-prueba="icono"]')).toBe(true);
    expect(pieza("button")).toBe(true);
    expect(pieza('[data-prueba="chip"]')).toBe(true);
    /* El marco y el texto no son piezas: el texto va por renglón. */
    expect(pieza('[data-prueba="tarjeta"]')).toBe(false);

    /* La tarjeta es fondo: pierde blanco y borde, y se rellena ella. La cabecera
       de adentro también se esconde, pero no se rellena otra vez. */
    const fondo = (sel) => document.querySelector(sel).getAttribute("data-esq-fondo");
    expect(fondo('[data-prueba="tarjeta"]')).toBe("afuera");
    expect(fondo('[data-prueba="cabecera"]')).toBe("");
    expect(pieza('[data-prueba="titulo"]')).toBe(false);
    expect(pieza('[data-prueba="suelto"]')).toBe(false);

    /* El molde no se toca ni se lee. */
    const molde = document.querySelector(".esq-molde");
    expect(molde).toHaveAttribute("inert");
    expect(molde).toHaveAttribute("aria-hidden", "true");

    /* Los renglones de texto también llevan cuadraditos, del alto de la letra. */
    await esperar(100);
    const enTexto = pintados.filter((p) => p.x >= 10 && p.x + p.w <= 70 && p.y >= 12 && p.y <= 28);
    expect(enTexto.length).toBeGreaterThan(0);

    /* Y el fondo de la tarjeta, con cuadraditos más chicos que los de las piezas:
       en reposo miden 3, y los de una pieza nunca bajan de 4. */
    expect(pintados.some((p) => p.w < 4)).toBe(true);
  });

  it("si cuando se monta ya no carga, va directo al contenido", async () => {
    const modulo = await importar();
    render(<Pantalla modulo={modulo} cargando={false} />);
    expect(screen.getByText("Calle Falsa 123")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("si vuelve a cargar desde cero, vuelve el esqueleto", async () => {
    const modulo = await importar({ canvas: false });
    const { rerender } = render(<Pantalla modulo={modulo} cargando={false} />);
    rerender(<Pantalla modulo={modulo} cargando />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(<Pantalla modulo={modulo} cargando={false} />);
    expect(await screen.findByText("Calle Falsa 123")).toBeInTheDocument();
  });

  it("con movimiento reducido no espera ni barre: cambia en seco", async () => {
    const modulo = await importar({ reducido: true });
    const { rerender } = render(<Pantalla modulo={modulo} cargando />);
    rerender(<Pantalla modulo={modulo} cargando={false} />);
    expect(await screen.findByText("Calle Falsa 123", {}, { timeout: 200 })).toBeInTheDocument();
  });

  it("sin canvas queda sólo el aviso de carga, y no hace esperar", async () => {
    const modulo = await importar({ canvas: false });
    const { rerender } = render(<Pantalla modulo={modulo} cargando />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tus domicilios…");
    expect(document.querySelector("[data-hueso]")).toBeNull();
    rerender(<Pantalla modulo={modulo} cargando={false} />);
    expect(await screen.findByText("Calle Falsa 123", {}, { timeout: 200 })).toBeInTheDocument();
  });
});
