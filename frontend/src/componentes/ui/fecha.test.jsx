import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CampoFecha, conBarras } from "./fecha";

describe("conBarras", () => {
  it("pone las barras solas a medida que se escribe", () => {
    expect(conBarras("1")).toBe("1");
    expect(conBarras("14")).toBe("14/");
    expect(conBarras("14/0")).toBe("14/0");
    expect(conBarras("14/07")).toBe("14/07/");
    expect(conBarras("14/07/2004")).toBe("14/07/2004");
  });

  it("al borrar no vuelve a poner la barra del final", () => {
    expect(conBarras("14", true)).toBe("14");
    expect(conBarras("14/07", true)).toBe("14/07");
  });

  it("acepta pegar la fecha con o sin separadores", () => {
    expect(conBarras("14072004")).toBe("14/07/2004");
    expect(conBarras("14-07-2004")).toBe("14/07/2004");
  });

  it("completa con cero un día o mes de un dígito seguido de barra", () => {
    expect(conBarras("1/7/2004")).toBe("01/07/2004");
  });

  it("ignora barras de más, letras y dígitos sobrantes", () => {
    expect(conBarras("14//")).toBe("14/");
    expect(conBarras("1a4")).toBe("14/");
    expect(conBarras("14/07/20041")).toBe("14/07/2004");
  });
});

function Prueba() {
  const [valor, setValor] = useState("");
  return (
    <>
      <CampoFecha etiqueta="Fecha" value={valor} onChange={(e) => setValor(e.target.value)} />
      <output data-testid="iso">{valor}</output>
    </>
  );
}

describe("CampoFecha", () => {
  it("escribiendo solo números queda la fecha con barras y emite ISO", async () => {
    render(<Prueba />);
    await userEvent.type(screen.getByLabelText("Fecha"), "14072004");

    expect(screen.getByLabelText("Fecha")).toHaveValue("14/07/2004");
    expect(screen.getByTestId("iso")).toHaveTextContent("2004-07-14");
  });

  it("escribir las barras igual sigue funcionando", async () => {
    render(<Prueba />);
    await userEvent.type(screen.getByLabelText("Fecha"), "14/07/2004");

    expect(screen.getByLabelText("Fecha")).toHaveValue("14/07/2004");
  });

  it("se puede borrar hacia atrás pasando por la barra", async () => {
    render(<Prueba />);
    const campo = screen.getByLabelText("Fecha");
    await userEvent.type(campo, "14");
    expect(campo).toHaveValue("14/");

    await userEvent.type(campo, "{Backspace}{Backspace}");
    expect(campo).toHaveValue("1");
  });
});
