import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderizar } from "@/pruebas/utilidades";
import { SeguimientoExterno } from "./SeguimientoExterno";

describe("Seguimiento de otros módulos", () => {
  it("muestra estado y mensaje públicos sin renderizar datos internos", async () => {
    const recurso = { cargando: false, error: null, datos: [{ sourceModule: "atencion-ciudadana", tipo: "TICKET",
      externalId: "ticket-1", estado: "PENDING_INFORMATION", actualizadoEn: "2026-10-27T10:00:00-03:00",
      datos: { publicId: "TK-2026-123", summary: "Luminaria apagada", publicMessage: "Indicanos la altura",
        internalMessage: "Nota privada" } }] };
    renderizar(<SeguimientoExterno recurso={recurso} ciudadanoId={1} />);
    expect(await screen.findByText("Luminaria apagada")).toBeInTheDocument();
    expect(screen.getByText(/Esperando información/)).toBeInTheDocument();
    expect(screen.getByText("Indicanos la altura")).toBeInTheDocument();
    expect(screen.queryByText("Nota privada")).not.toBeInTheDocument();
  });

  it("no muestra una lista de ejemplo cuando no hay trámites externos", () => {
    renderizar(<SeguimientoExterno recurso={{ cargando: false, error: null, datos: [] }} ciudadanoId={1} />);
    expect(screen.queryByRole("heading", { name: "Seguimiento de otros módulos" })).not.toBeInTheDocument();
  });
});
