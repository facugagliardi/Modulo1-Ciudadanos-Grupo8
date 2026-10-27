import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BotonDelMenu, MenuMovil, useMenuMovil } from "./MenuMovil";

const GRUPOS = [
  {
    titulo: "Mi legajo",
    items: [
      { a: "/portal", texto: "Inicio", exacto: true },
      { a: "/portal/domicilios", texto: "Domicilios" },
    ],
  },
  { titulo: "Mis trámites", items: [{ a: "/portal/expedientes", texto: "Expedientes" }] },
];

function Barra() {
  const menu = useMenuMovil();
  return (
    <>
      <BotonDelMenu menu={menu} />
      <MenuMovil menu={menu} grupos={GRUPOS} pie={<p>El pie</p>} />
    </>
  );
}

function montar(ruta = "/portal") {
  return render(
    <MemoryRouter initialEntries={[ruta]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Barra />
      <Routes>
        <Route path="/portal" element={<p>Pantalla de inicio</p>} />
        <Route path="/portal/domicilios" element={<p>Pantalla de domicilios</p>} />
        <Route path="/portal/expedientes" element={<p>Pantalla de expedientes</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const menu = () => document.querySelector(".cmm-menu");
const boton = () => screen.getByRole("button", { name: /menú|cerrar/i });

describe("MenuMovil", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({ matches: false }));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.matchMedia;
  });

  it("cerrado no tiene destinos, y el botón dice Menú", () => {
    montar();
    expect(boton()).toHaveAccessibleName("Menú");
    expect(boton()).toHaveAttribute("aria-expanded", "false");
    expect(menu()).toHaveAttribute("data-fase", "cerrado");
    expect(menu()).toHaveAttribute("inert");
    expect(screen.queryByRole("link", { name: "Domicilios" })).toBeNull();
  });

  it("abre con los grupos, la cascada en un solo contador y el activo marcado", async () => {
    montar();
    await userEvent.click(boton());

    expect(boton()).toHaveAccessibleName("Cerrar");
    expect(menu()).toHaveAttribute("data-fase", "abierto");
    expect(menu()).not.toHaveAttribute("inert");
    expect(screen.getByText("Mi legajo")).toBeInTheDocument();
    expect(screen.getByText("El pie")).toBeInTheDocument();
    /* Dos títulos y tres destinos: cinco en la cascada, numerados en el orden
       en que se leen. */
    expect(menu().style.getPropertyValue("--cmm-n")).toBe("5");
    const indices = [...menu().querySelectorAll(".cmm-menu__entra")].map((el) =>
      el.style.getPropertyValue("--cmm-i"),
    );
    expect(indices).toEqual(["0", "1", "2", "3", "4"]);
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveClass("cmm-menu__enlace--activo");
    expect(screen.getByRole("link", { name: "Domicilios" })).not.toHaveClass("cmm-menu__enlace--activo");
  });

  it("al cerrar pasa por la salida y recién después se vacía", async () => {
    montar();
    await userEvent.click(boton());
    vi.useFakeTimers();
    act(() => boton().click());

    expect(menu()).toHaveAttribute("data-fase", "cerrando");
    /* Los destinos siguen montados: tienen que alcanzar a irse. */
    expect(screen.getByRole("link", { name: "Domicilios" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(780));
    expect(menu()).toHaveAttribute("data-fase", "cerrado");
    expect(screen.queryByRole("link", { name: "Domicilios" })).toBeNull();
  });

  it("Escape cierra y devuelve el foco al botón", async () => {
    montar();
    await userEvent.click(boton());
    await userEvent.keyboard("{Escape}");

    expect(menu()).toHaveAttribute("data-fase", "cerrando");
    expect(boton()).toHaveFocus();
  });

  it("ir a otra sección lo cierra de golpe, sin la salida: se va con la foto vieja", async () => {
    montar();
    await userEvent.click(boton());
    await userEvent.click(screen.getByRole("link", { name: "Expedientes" }));

    expect(await screen.findByText("Pantalla de expedientes")).toBeInTheDocument();
    expect(menu()).toHaveAttribute("data-fase", "cerrado");
  });

  it("tocar la sección en la que ya estás lo cierra con su salida", async () => {
    montar();
    await userEvent.click(boton());
    await userEvent.click(screen.getByRole("link", { name: "Inicio" }));

    expect(menu()).toHaveAttribute("data-fase", "cerrando");
  });

  it("abierto, la página de atrás no scrollea", async () => {
    montar();
    await userEvent.click(boton());
    expect(document.documentElement.style.overflow).toBe("hidden");
    await userEvent.click(screen.getByRole("link", { name: "Expedientes" }));
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("con movimiento reducido cierra en el acto", async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    montar();
    await userEvent.click(boton());
    await userEvent.click(boton());
    expect(menu()).toHaveAttribute("data-fase", "cerrado");
  });
});
