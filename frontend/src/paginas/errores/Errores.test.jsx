import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { EnConstruccion, NoEncontrado, SinPermiso } from "./Errores";
import { conSesion, renderizar, sinSesion } from "@/pruebas/utilidades";

describe("SinPermiso", () => {
  it("nombra el rol que tiene la persona", () => {
    conSesion({ rol: "AUDITOR", subType: "EMPLEADO" });
    renderizar(<SinPermiso />);

    expect(screen.getByText(/no tenés acceso a esta sección/i)).toBeInTheDocument();
    expect(screen.getByText("Auditor")).toBeInTheDocument();
  });

  it("funciona aunque no haya sesión", () => {
    sinSesion();
    renderizar(<SinPermiso />);
    expect(screen.getByText(/no tenés acceso/i)).toBeInTheDocument();
  });
});

describe("NoEncontrado", () => {
  it("explica y ofrece una salida en lugar de dejar a la persona varada", () => {
    sinSesion();
    renderizar(<NoEncontrado />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver al inicio/i })).toHaveAttribute("href", "/");
  });
});

describe("EnConstruccion", () => {
  it("dice con todas las letras que la sección todavía no está", () => {
    sinSesion();
    renderizar(<EnConstruccion seccion="Gestión interna" titulo="Tablero" />);

    expect(screen.getByRole("heading", { name: "Tablero" })).toBeInTheDocument();
    expect(screen.getByText("Gestión interna")).toBeInTheDocument();
    expect(screen.getByText(/todavía no está construida/i)).toBeInTheDocument();
  });
});
