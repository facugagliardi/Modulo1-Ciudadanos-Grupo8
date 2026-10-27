import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * El molde de la tabla mientras carga. Va aparte de `Tabla.test.jsx` porque
 * necesita canvas —sin canvas el molde no se monta— y el esqueleto recuerda si
 * hay uno: se importa de nuevo con un contexto 2D de mentira.
 */
const COLUMNAS = [
  { clave: "apellido", titulo: "Apellido" },
  { clave: "dni", titulo: "DNI", alineacion: "derecha" },
];

async function tablaConCanvas() {
  vi.resetModules();
  HTMLCanvasElement.prototype.getContext = () => ({
    setTransform() {},
    clearRect() {},
    fillRect() {},
  });
  const { Tabla } = await import("./Tabla");
  return Tabla;
}

describe("Tabla: esqueleto de carga", () => {
  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });

  it("el molde es la tabla misma: sus encabezados y filas del alto de las reales", async () => {
    const Tabla = await tablaConCanvas();
    render(
      <MemoryRouter>
        <Tabla columnas={COLUMNAS} filas={null} claveFila={(f) => f.id} cargando />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Cargando el listado…");
    const molde = document.querySelector(".esq-molde");
    expect([...molde.querySelectorAll("th")].map((th) => th.textContent)).toEqual([
      expect.stringContaining("Apellido"),
      expect.stringContaining("DNI"),
    ]);

    const filas = molde.querySelectorAll("tbody tr");
    expect(filas.length).toBe(6);
    /* Cada celda con su renglón, alineado como su columna. */
    const [, celdaDni] = filas[0].querySelectorAll("td");
    expect(celdaDni.querySelector("[data-hueso]")).toHaveClass("ml-auto");
    expect(molde.textContent).toContain("resultados");

    /* La paginación va en un molde aparte, debajo: así sube con el alto de la
       tabla cuando llegan menos filas que las del molde. La carga se anuncia
       una sola vez. */
    const [, paginacion] = document.querySelectorAll(".esq-molde");
    expect(paginacion.querySelector("nav[aria-label='Paginación']")).not.toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
