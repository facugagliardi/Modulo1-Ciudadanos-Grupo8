import { describe, expect, it, vi } from "vitest";
import { useCallback, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRecurso } from "./useRecurso";

/**
 * Estas pruebas cuidan una regresión concreta: el hook aceptaba un array
 * `deps` y volvía a memoizar la función del llamador con él. Como todos los
 * llamadores ya usan useCallback, ese `deps` vacío por defecto congelaba la
 * PRIMERA versión de la función y el recurso no se recargaba nunca al cambiar
 * sus dependencias.
 *
 * Se manifestó en la carátula del expediente: el titular se pedía con el
 * `personaId` todavía indefinido y quedaba en "Persona #1" para siempre.
 */

function Sonda({ cargar }) {
  const { datos, error, cargando, recargar } = useRecurso(cargar);
  return (
    <div>
      <span data-testid="estado">
        {cargando ? "cargando" : error ? `error:${error.message}` : String(datos)}
      </span>
      <button onClick={recargar}>Recargar</button>
    </div>
  );
}

function ConDependencia({ traer }) {
  const [id, setId] = useState(1);
  const cargar = useCallback((s) => traer(id, s), [traer, id]);
  return (
    <>
      <Sonda cargar={cargar} />
      <button onClick={() => setId(2)}>Cambiar a 2</button>
    </>
  );
}

describe("useRecurso", () => {
  it("carga y expone los datos", async () => {
    const cargar = vi.fn().mockResolvedValue("hola");
    render(<Sonda cargar={cargar} />);
    expect(screen.getByTestId("estado")).toHaveTextContent("cargando");
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("hola"));
  });

  it("expone el error sin romper la pantalla", async () => {
    const cargar = vi.fn().mockRejectedValue(new Error("se cayó"));
    render(<Sonda cargar={cargar} />);
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("error:se cayó"));
  });

  it("recarga a pedido", async () => {
    const cargar = vi.fn().mockResolvedValue("uno");
    render(<Sonda cargar={cargar} />);
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("uno"));

    cargar.mockResolvedValue("dos");
    await userEvent.click(screen.getByRole("button", { name: "Recargar" }));
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("dos"));
  });

  it("vuelve a cargar cuando cambia una dependencia del llamador", async () => {
    // La regresión: con el `deps` viejo esto se quedaba en "dato-1".
    const traer = vi.fn((id) => Promise.resolve(`dato-${id}`));
    render(<ConDependencia traer={traer} />);
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("dato-1"));

    await userEvent.click(screen.getByRole("button", { name: "Cambiar a 2" }));
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("dato-2"));
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it("le pasa una señal de cancelación a quien carga", async () => {
    const cargar = vi.fn().mockResolvedValue("x");
    render(<Sonda cargar={cargar} />);
    await waitFor(() => expect(cargar).toHaveBeenCalled());
    expect(cargar.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it("ignora el AbortError, que no es una falla real", async () => {
    const abortado = Object.assign(new Error("cancelado"), { name: "AbortError" });
    const cargar = vi.fn().mockRejectedValue(abortado);
    render(<Sonda cargar={cargar} />);
    // No pinta error: se queda esperando, porque el pedido fue cancelado.
    await waitFor(() => expect(screen.getByTestId("estado")).not.toHaveTextContent("error:"));
  });
});
