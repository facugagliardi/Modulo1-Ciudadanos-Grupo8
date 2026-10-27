import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ProveedorDeSesion } from "@/lib/auth/SesionContext";
import { conSesion } from "@/pruebas/utilidades";
import { LayoutPortal } from "./LayoutPortal";
import { htmlDelFantasma } from "./fantasmasPortal";
import { deslizarSeccion } from "@/lib/movimiento/deslizarSeccion";

vi.mock("@/lib/movimiento/deslizarSeccion", async (original) => ({
  ...(await original()),
  deslizarSeccion: vi.fn((_direccion, _fantasmas, navegar) => navegar()),
}));

function portal(ruta = "/portal") {
  return render(
    <ProveedorDeSesion>
      <MemoryRouter initialEntries={[ruta]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/portal" element={<LayoutPortal />}>
            <Route
              index
              element={
                <>
                  <p>Pantalla de inicio</p>
                  <Link to="/portal/domicilios?nuevo=1">Cargar domicilio</Link>
                  <a href="https://example.com/portal/perfil">Otro sitio</a>
                  <a href="/portal/perfil" target="_blank" rel="noreferrer">
                    En otra pestaña
                  </a>
                </>
              }
            />
            <Route path="domicilios" element={<Domicilios />} />
            <Route path="perfil" element={<p>Pantalla de mis datos</p>} />
            <Route path="organizaciones/:id" element={<p>Una organización</p>} />
            <Route path="organizaciones" element={<p>Pantalla de organizaciones</p>} />
            <Route path="expedientes" element={<p>Pantalla de expedientes</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ProveedorDeSesion>,
  );
}

/** Muestra la consulta con la que se llegó, para ver que el salto la conserva. */
function Domicilios() {
  return <p>Pantalla de domicilios{useLocation().search}</p>;
}

const barra = () => document.querySelector(".barra-goma");

describe("LayoutPortal: cambio de sección", () => {
  beforeEach(() => {
    conSesion({ id: 3, rol: "PERSONA", subType: "CIUDADANO" });
    deslizarSeccion.mockClear();
  });

  afterEach(() => {
    delete document.documentElement.dataset.seccion;
  });

  it("un salto largo empuja hacia la derecha pasando por las secciones del medio", async () => {
    portal();
    await userEvent.click(screen.getByRole("link", { name: "Expedientes" }));

    expect(await screen.findByText("Pantalla de expedientes")).toBeInTheDocument();
    const [direccion, fantasmas] = deslizarSeccion.mock.calls[0];
    expect(direccion).toBe("derecha");
    /* De Inicio a Expedientes quedan siete en el medio, de la vecina del origen
       a la del destino. */
    expect(fantasmas).toHaveLength(7);
    expect(fantasmas[0]).toBe(htmlDelFantasma("/portal/perfil", "Mis datos"));
    expect(fantasmas.at(-1)).toBe(
      htmlDelFantasma("/portal/documentacion-solicitada", "Lo que me piden"),
    );
  });

  it("hacia una pestaña de la izquierda, el orden del medio va al revés", async () => {
    portal("/portal/expedientes");
    await userEvent.click(screen.getByRole("link", { name: "Mis datos" }));

    expect(await screen.findByText("Pantalla de mis datos")).toBeInTheDocument();
    const [direccion, fantasmas] = deslizarSeccion.mock.calls[0];
    expect(direccion).toBe("izquierda");
    expect(fantasmas[0]).toBe(htmlDelFantasma("/portal/documentacion-solicitada", "Lo que me piden"));
  });

  it("volver a la sección desde una de sus pantallas navega sin empujón", async () => {
    portal("/portal/organizaciones/7");
    await userEvent.click(screen.getByRole("link", { name: "Organizaciones" }));

    expect(await screen.findByText("Pantalla de organizaciones")).toBeInTheDocument();
    expect(deslizarSeccion).not.toHaveBeenCalled();
  });

  it("un enlace de adentro de una pantalla que lleva a otra sección también empuja", async () => {
    portal();
    await userEvent.click(screen.getByRole("link", { name: "Cargar domicilio" }));

    expect(await screen.findByText(/^Pantalla de domicilios/)).toBeInTheDocument();
    const [direccion, fantasmas] = deslizarSeccion.mock.calls[0];
    expect(direccion).toBe("derecha");
    expect(fantasmas).toEqual([htmlDelFantasma("/portal/perfil", "Mis datos")]);
  });

  it("llega a la ruta entera del enlace, con su consulta", async () => {
    portal();
    await userEvent.click(screen.getByRole("link", { name: "Cargar domicilio" }));
    expect(await screen.findByText("Pantalla de domicilios?nuevo=1")).toBeInTheDocument();
  });

  it("los enlaces a otro sitio o a otra pestaña no los toca", async () => {
    portal();
    const frenar = (e) => e.preventDefault();
    window.addEventListener("click", frenar);
    await userEvent.click(screen.getByRole("link", { name: "Otro sitio" }));
    await userEvent.click(screen.getByRole("link", { name: "En otra pestaña" }));
    window.removeEventListener("click", frenar);
    expect(deslizarSeccion).not.toHaveBeenCalled();
  });

  it("todas las pestañas van en negrita, así la activa no cambia de ancho", () => {
    portal();
    for (const pestania of screen.getAllByRole("link").filter((a) => a.closest("nav"))) {
      expect(pestania).toHaveClass("font-semibold");
    }
  });

  it("un click con Ctrl lo resuelve el navegador", async () => {
    portal();
    /* Después del de React, para que jsdom no intente abrir otra pestaña. */
    const frenar = (e) => e.preventDefault();
    window.addEventListener("click", frenar);
    const usuario = userEvent.setup();
    await usuario.keyboard("{Control>}");
    await usuario.click(screen.getByRole("link", { name: "Expedientes" }));
    await usuario.keyboard("{/Control}");
    window.removeEventListener("click", frenar);
    expect(deslizarSeccion).not.toHaveBeenCalled();
  });

  it("la pantalla que llega empujada no suma la entrada", async () => {
    deslizarSeccion.mockImplementationOnce((_d, _f, navegar) => {
      document.documentElement.dataset.seccion = "derecha";
      navegar();
    });
    portal();
    expect(document.querySelector("main")).toHaveClass("entrada");

    await userEvent.click(screen.getByRole("link", { name: "Mis datos" }));
    await screen.findByText("Pantalla de mis datos");
    expect(document.querySelector("main")).not.toHaveClass("entrada");
  });
});

describe("LayoutPortal: la barra de la pestaña activa", () => {
  beforeEach(() => conSesion({ id: 3, rol: "PERSONA", subType: "CIUDADANO" }));

  it("hay una sola barra, fuera del árbol accesible, y se ve con una pestaña activa", () => {
    portal();
    expect(document.querySelectorAll(".barra-goma")).toHaveLength(1);
    expect(barra()).toHaveAttribute("aria-hidden", "true");
    expect(barra().style.opacity).toBe("1");
  });

  it("se esconde si la ruta no tiene pestaña y vuelve cuando la tiene", async () => {
    portal();
    /* Se le saca la marca a mano: es lo que pasaría en una ruta sin pestaña. */
    const activa = screen.getByRole("link", { name: "Inicio" });
    await act(async () => activa.removeAttribute("aria-current"));
    expect(barra().style.opacity).toBe("0");

    await act(async () => activa.setAttribute("aria-current", "page"));
    expect(barra().style.opacity).toBe("1");
  });

  it("en angosto, el menú del teléfono agrupa las secciones y empuja igual", async () => {
    portal();
    await userEvent.click(screen.getByRole("button", { name: "Menú" }));

    const dialogo = screen.getByRole("dialog", { name: "Menú de secciones" });
    expect(within(dialogo).getByText("Mi legajo")).toBeInTheDocument();
    expect(within(dialogo).getByText("Mis trámites")).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Salir" })).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("link", { name: "Expedientes" }));

    expect(await screen.findByText("Pantalla de expedientes")).toBeInTheDocument();
    expect(deslizarSeccion.mock.calls[0][0]).toBe("derecha");
    expect(screen.queryByRole("dialog", { name: "Menú de secciones" })).toHaveAttribute("data-fase", "cerrado");
  });

  it("en angosto el empujón es vertical, como la columna del menú", async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn((consulta) => ({ matches: consulta === "(max-width: 1023px)" }));
    portal();
    await userEvent.click(screen.getByRole("button", { name: "Menú" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Menú de secciones" })).getByRole("link", {
        name: "Expedientes",
      }),
    );

    expect(await screen.findByText("Pantalla de expedientes")).toBeInTheDocument();
    expect(deslizarSeccion.mock.calls[0][0]).toBe("abajo");
    window.matchMedia = original;
  });
});
