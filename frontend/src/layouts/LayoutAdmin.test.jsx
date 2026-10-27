import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { ProveedorDeSesion } from "@/lib/auth/SesionContext";
import { conSesion } from "@/pruebas/utilidades";
import { LayoutAdmin } from "./LayoutAdmin";
import { htmlDelFantasma } from "./fantasmasAdmin";
import { deslizarSeccion } from "@/lib/movimiento/deslizarSeccion";

vi.mock("@/lib/movimiento/deslizarSeccion", async (original) => ({
  ...(await original()),
  deslizarSeccion: vi.fn((_direccion, _fantasmas, navegar) => navegar()),
}));

function backoffice(ruta = "/admin") {
  return render(
    <ProveedorDeSesion>
      <MemoryRouter initialEntries={[ruta]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/admin" element={<LayoutAdmin />}>
            <Route
              index
              element={
                <>
                  <p>Pantalla del tablero</p>
                  <Link to="/admin/expedientes">Ver expedientes</Link>
                </>
              }
            />
            <Route path="padron" element={<p>Pantalla del padrón</p>} />
            <Route path="padron/:id" element={<p>Un legajo</p>} />
            <Route path="expedientes" element={<p>Pantalla de expedientes</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ProveedorDeSesion>,
  );
}

const menu = () => screen.getByRole("navigation", { name: "Secciones" });

describe("LayoutAdmin: cambio de sección", () => {
  beforeEach(() => {
    conSesion({ id: 1, rol: "RESPONSABLE_AREA" });
    deslizarSeccion.mockClear();
  });

  it("bajar en el menú empuja hacia abajo, pasando por las secciones del medio", async () => {
    backoffice();
    await userEvent.click(screen.getByRole("link", { name: "Expedientes" }));

    expect(await screen.findByText("Pantalla de expedientes")).toBeInTheDocument();
    const [direccion, fantasmas, , densidad] = deslizarSeccion.mock.calls[0];
    expect(direccion).toBe("abajo");
    expect(densidad).toBe("densidad-compacta");
    expect(fantasmas).toEqual([
      htmlDelFantasma("/admin/padron", "Padrón"),
      htmlDelFantasma("/admin/organizaciones", "Organizaciones"),
      htmlDelFantasma("/admin/documentacion", "Documentación"),
    ]);
  });

  it("subir empuja hacia arriba, también desde el detalle de una sección", async () => {
    backoffice("/admin/padron/7");
    await userEvent.click(screen.getByRole("link", { name: "Tablero" }));

    expect(await screen.findByText("Pantalla del tablero")).toBeInTheDocument();
    expect(deslizarSeccion.mock.calls[0][0]).toBe("arriba");
  });

  it("un enlace de la pantalla a otra sección también empuja", async () => {
    backoffice();
    await userEvent.click(screen.getByRole("link", { name: "Ver expedientes" }));

    expect(await screen.findByText("Pantalla de expedientes")).toBeInTheDocument();
    expect(deslizarSeccion.mock.calls[0][0]).toBe("abajo");
  });

  it("la cabecera y el menú quedan marcados para quedarse quietos", () => {
    backoffice();
    expect(document.querySelector("header[data-cabecera]")).toBeInTheDocument();
    expect(menu()).toHaveAttribute("data-lateral");
  });

  it("en angosto, el menú del teléfono tiene las secciones, quién está y salir, y empuja igual", async () => {
    backoffice();
    await userEvent.click(screen.getByRole("button", { name: "Menú" }));

    const dialogo = screen.getByRole("dialog", { name: "Menú de secciones" });
    expect(within(dialogo).getByText("Legajo 1")).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Salir" })).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("link", { name: "Padrón" }));

    expect(await screen.findByText("Pantalla del padrón")).toBeInTheDocument();
    expect(deslizarSeccion.mock.calls[0][0]).toBe("abajo");
  });
});
