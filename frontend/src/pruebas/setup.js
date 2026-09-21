import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// El desplegable de Radix se reemplaza por un doble en todas las pruebas.
// El porqué, largo y con la evidencia, está en el propio archivo del doble.
vi.mock("@radix-ui/react-select", async () => import("./mocks/radix-select.jsx"));

/**
 * Lo que jsdom no implementa y Radix sí usa.
 *
 * Radix maneja los desplegables con Pointer Events y mide el panel para
 * ubicarlo. jsdom no trae ni la captura de puntero ni `scrollIntoView` ni
 * `ResizeObserver`, así que sin estos stubs el Selector y el calendario
 * explotan apenas se abren —y el error que tiran no dice nada de todo esto.
 *
 * No son mocks de la app: son huecos del entorno de pruebas.
 */
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
/**
 * jsdom no implementa `PointerEvent`. Sin esta clase, los eventos de puntero se
 * despachan como `Event` pelado y pierden `button` y `pointerType` — que es
 * justo lo que Radix mira para decidir si abre el panel. El síntoma era una
 * prueba colgada hasta el timeout, sin ningún error que apuntara acá.
 *
 * Hereda de MouseEvent para no tener que reimplementar `button`.
 */
if (!globalThis.PointerEvent) {
  class PointerEventDePrueba extends MouseEvent {
    constructor(tipo, props = {}) {
      super(tipo, props);
      this.pointerId = props.pointerId ?? 1;
      this.pointerType = props.pointerType ?? "mouse";
      this.isPrimary = props.isPrimary ?? true;
    }
  }
  globalThis.PointerEvent = PointerEventDePrueba;
}

// jsdom no implementa la API de object URLs. El visor de documentos la usa
// para mostrar un binario que se bajó autenticado, así que sin esto ni
// siquiera se puede montar.
if (!URL.createObjectURL) {
  let n = 0;
  URL.createObjectURL = () => `blob:prueba/${++n}`;
  URL.revokeObjectURL = () => {};
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});
