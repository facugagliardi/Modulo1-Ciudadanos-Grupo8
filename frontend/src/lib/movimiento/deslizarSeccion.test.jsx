import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { deslizarSeccion, estaDeslizando, useAvisoDeRuta } from "./deslizarSeccion";

/**
 * jsdom no tiene View Transitions ni Web Animations. Se reemplazan por un doble
 * que corre el callback del cambio de DOM como el navegador —entre las dos
 * fotos— y deja resolver `ready` y `finished` a mano.
 */
function transicionFalsa() {
  let listo;
  let terminar;
  const ready = new Promise((r) => (listo = r));
  const finished = new Promise((r) => (terminar = r));
  const llamada = { callback: null, listo, terminar };
  document.startViewTransition = vi.fn((callback) => {
    llamada.callback = callback;
    return { ready, finished };
  });
  return llamada;
}

/**
 * Corre el callback del cambio de DOM. Se espera **afuera** del `act`: el
 * callback espera el commit de la ruta, y adentro del `act` React no lo
 * confirma hasta que el `act` termina —se quedaría hasta el tope de 1,2 s—.
 */
async function correrCallback(vt) {
  let corriendo;
  /* La parte sincrónica —el navigate— va adentro; la espera, afuera. */
  await act(async () => {
    corriendo = vt.callback();
  });
  await corriendo;
}

/** Monta un router con el aviso de ruta, y deja a mano su `navigate`. */
function montarRouter() {
  const ref = {};
  function Sonda() {
    useAvisoDeRuta();
    ref.navegar = useNavigate();
    return null;
  }
  render(
    <MemoryRouter initialEntries={["/portal"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Sonda />
    </MemoryRouter>,
  );
  return ref;
}

describe("deslizarSeccion", () => {
  let animadas;

  beforeEach(() => {
    animadas = [];
    document.documentElement.animate = vi.fn((keyframes, opciones) => {
      const animacion = { keyframes, opciones, cancel: vi.fn() };
      animadas.push(animacion);
      return animacion;
    });
    window.scrollTo = vi.fn();
    window.matchMedia = vi.fn(() => ({ matches: false }));
  });

  afterEach(() => {
    delete document.startViewTransition;
    delete document.documentElement.animate;
    delete document.documentElement.dataset.seccion;
    document.querySelectorAll(".cdn-fantasma").forEach((f) => f.remove());
  });

  it("sin View Transitions navega en seco", () => {
    const navegar = vi.fn();
    deslizarSeccion("derecha", [], navegar);
    expect(navegar).toHaveBeenCalledOnce();
    expect(estaDeslizando()).toBe(false);
  });

  it("sin dirección navega en seco aunque el navegador las tenga", () => {
    transicionFalsa();
    const navegar = vi.fn();
    deslizarSeccion(null, [], navegar);
    expect(navegar).toHaveBeenCalledOnce();
    expect(document.startViewTransition).not.toHaveBeenCalled();
  });

  it("con movimiento reducido navega en seco", () => {
    transicionFalsa();
    window.matchMedia = vi.fn(() => ({ matches: true }));
    const navegar = vi.fn();
    deslizarSeccion("izquierda", [], navegar);
    expect(navegar).toHaveBeenCalledOnce();
    expect(document.startViewTransition).not.toHaveBeenCalled();
  });

  it("empuja la tira entera, con los fantasmas del medio, y limpia al terminar", async () => {
    const vt = transicionFalsa();
    const router = montarRouter();
    const navegar = vi.fn(() => router.navegar("/portal/expedientes"));

    deslizarSeccion("derecha", ["<p>uno</p>", "<p>dos</p>"], navegar);
    expect(estaDeslizando()).toBe(true);
    expect(document.documentElement.dataset.seccion).toBe("derecha");

    /* El navegador saca la foto vieja y corre el callback: se navega y se
       montan los fantasmas antes de la foto nueva. */
    await correrCallback(vt);
    expect(navegar).toHaveBeenCalledOnce();
    const fantasmas = document.querySelectorAll(".cdn-fantasma");
    expect([...fantasmas].map((f) => f.style.getPropertyValue("view-transition-name"))).toEqual([
      "cdn-tunel-1",
      "cdn-tunel-2",
    ]);
    expect(fantasmas[0].innerHTML).toBe("<p>uno</p>");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });

    await act(async () => vt.listo());
    /* Cuatro piezas —vieja, dos fantasmas, nueva— con movimiento y desenfoque. */
    const piezas = animadas.map((a) => a.opciones.pseudoElement);
    expect(new Set(piezas)).toEqual(
      new Set([
        "::view-transition-old(root)",
        "::view-transition-new(cdn-tunel-1)",
        "::view-transition-new(cdn-tunel-2)",
        "::view-transition-new(root)",
      ]),
    );
    expect(animadas).toHaveLength(8);
    /* Hacia la derecha el contenido se va a la izquierda: tres pantallas. */
    const vieja = animadas.find((a) => a.opciones.pseudoElement === "::view-transition-old(root)");
    expect(vieja.keyframes.at(-1).transform).toBe(`translateX(${-3 * window.innerWidth}px)`);

    await act(async () => vt.terminar());
    expect(document.querySelectorAll(".cdn-fantasma")).toHaveLength(0);
    expect(estaDeslizando()).toBe(false);
    expect(animadas.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
  });

  it("hacia la izquierda, entre vecinas, el contenido va a la derecha y sin desenfoque", async () => {
    const vt = transicionFalsa();
    const router = montarRouter();
    deslizarSeccion("izquierda", [], () => router.navegar("/portal/perfil"));
    await correrCallback(vt);
    await act(async () => vt.listo());
    expect(animadas).toHaveLength(2);
    const nueva = animadas.find((a) => a.opciones.pseudoElement === "::view-transition-new(root)");
    expect(nueva.keyframes.map((k) => k.transform)).toEqual([
      `translateX(${-window.innerWidth}px)`,
      "translateX(0px)",
    ]);
  });

  it("en el backoffice, hacia abajo sube el contenido, y los fantasmas arrancan al costado de la barra", async () => {
    const vt = transicionFalsa();
    const router = montarRouter();
    /* La barra lateral al costado del contenido, como en una pantalla ancha. */
    const lateral = document.createElement("nav");
    lateral.setAttribute("data-lateral", "");
    Object.defineProperty(lateral, "offsetWidth", { value: 240 });
    document.body.append(lateral);

    deslizarSeccion("abajo", ["<p>padrón</p>"], () => router.navegar("/admin/organizaciones"), "densidad-compacta");
    await correrCallback(vt);
    const [fantasma] = document.querySelectorAll(".cdn-fantasma");
    expect(fantasma).toHaveClass("densidad-compacta");
    expect(fantasma.style.getPropertyValue("--izquierda")).toBe("240px");

    await act(async () => vt.listo());
    const vieja = animadas.find((a) => a.opciones.pseudoElement === "::view-transition-old(root)");
    expect(vieja.keyframes.map((k) => k.transform)).toEqual([
      "translateY(0px)",
      `translateY(${-2 * window.innerHeight}px)`,
    ]);
    const tunel = animadas.find((a) => a.opciones.pseudoElement === "::view-transition-new(cdn-tunel-1)");
    expect(tunel.keyframes[0].transform).toBe(`translateY(${window.innerHeight}px)`);
    lateral.remove();
  });

  it("hacia arriba, el contenido baja", async () => {
    const vt = transicionFalsa();
    const router = montarRouter();
    deslizarSeccion("arriba", [], () => router.navegar("/admin"), "densidad-compacta");
    await correrCallback(vt);
    await act(async () => vt.listo());
    const nueva = animadas.find((a) => a.opciones.pseudoElement === "::view-transition-new(root)");
    expect(nueva.keyframes.map((k) => k.transform)).toEqual([
      `translateY(${-window.innerHeight}px)`,
      "translateY(0px)",
    ]);
  });

  it("el pie no se va con la tira: si en la pantalla nueva queda a otra altura, va hasta ahí en vertical", async () => {
    const vt = transicionFalsa();
    const router = montarRouter();
    const pie = document.createElement("footer");
    pie.setAttribute("data-pie", "");
    document.body.append(pie);
    /* En la pantalla vieja estaba en 900; la nueva es más corta y lo deja en 600. */
    let top = 900;
    pie.getBoundingClientRect = () => ({ top, left: 0, width: 800, height: 60 });

    deslizarSeccion("derecha", [], () => router.navegar("/portal/perfil"));
    top = 600;
    await correrCallback(vt);
    await act(async () => vt.listo());

    const delPie = animadas.find((a) => a.opciones.pseudoElement === "::view-transition-group(cdn-pie)");
    expect(delPie.keyframes).toEqual([{ translate: "0 300px" }, { translate: "0 0" }]);
    /* Nada de costado: la tira sigue siendo vieja y nueva, nada más. */
    expect(animadas.filter((a) => a.opciones.pseudoElement !== "::view-transition-group(cdn-pie)")).toHaveLength(2);
    pie.remove();
  });
});
