import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CambiarEstado } from "./CambiarEstado";
import { BadgeEstado } from "./BadgeEstado";
import { ENTIDADES } from "@/lib/dominio/estados";
import { ErrorApi } from "@/lib/api/cliente";
import { renderizar } from "@/pruebas/utilidades";

describe("CambiarEstado", () => {
  it("sólo ofrece destinos que el backend acepta", async () => {
    renderizar(
      <CambiarEstado
        entidad={ENTIDADES.EXPEDIENTE}
        estadoActual="INICIADO"
        alConfirmar={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /cambiar estado/i }));

    expect(screen.getByRole("radio", { name: /en trámite/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /archivado/i })).toBeInTheDocument();
    // INICIADO -> RESUELTO no existe en el grafo: el backend lo rechazaría.
    expect(screen.queryByRole("radio", { name: /resuelto/i })).not.toBeInTheDocument();
  });

  it("nunca ofrece el estado actual, que también da 400", async () => {
    renderizar(
      <CambiarEstado entidad={ENTIDADES.CIUDADANO} estadoActual="ACTIVO" alConfirmar={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /cambiar estado/i }));
    expect(screen.queryByRole("radio", { name: /^activo$/i })).not.toBeInTheDocument();
  });

  it("advierte antes de aplicar un estado del que no se vuelve", async () => {
    renderizar(
      <CambiarEstado
        entidad={ENTIDADES.CIUDADANO}
        estadoActual="ACTIVO"
        nombreEntidad="este vecino"
        alConfirmar={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /cambiar estado/i }));
    await userEvent.click(screen.getByRole("radio", { name: /fallecido/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/estado final/i);
    expect(screen.getByRole("button", { name: /confirmar cambio/i })).toBeInTheDocument();
  });

  it("no deja confirmar sin elegir nada", async () => {
    renderizar(
      <CambiarEstado entidad={ENTIDADES.CIUDADANO} estadoActual="ACTIVO" alConfirmar={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /cambiar estado/i }));
    expect(screen.getByRole("button", { name: /confirmar cambio/i })).toBeDisabled();
  });

  it("aplica el cambio elegido", async () => {
    const alConfirmar = vi.fn().mockResolvedValue({});
    renderizar(
      <CambiarEstado
        entidad={ENTIDADES.EXPEDIENTE}
        estadoActual="INICIADO"
        alConfirmar={alConfirmar}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /cambiar estado/i }));
    await userEvent.click(screen.getByRole("radio", { name: /en trámite/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar cambio/i }));

    expect(alConfirmar).toHaveBeenCalledWith("EN_TRAMITE");
  });

  it("muestra el error del backend sin cerrar el diálogo", async () => {
    const alConfirmar = vi
      .fn()
      .mockRejectedValue(new ErrorApi({ status: 403, message: "Tu rol no tiene permiso" }));
    renderizar(
      <CambiarEstado entidad={ENTIDADES.CIUDADANO} estadoActual="ACTIVO" alConfirmar={alConfirmar} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /cambiar estado/i }));
    await userEvent.click(screen.getByRole("radio", { name: /inactivo/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar cambio/i }));

    expect(await screen.findByText(/no tiene permiso/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar cambio/i })).toBeInTheDocument();
  });

  it("en un estado terminal no ofrece cambiar nada", () => {
    renderizar(
      <CambiarEstado entidad={ENTIDADES.CIUDADANO} estadoActual="FALLECIDO" alConfirmar={vi.fn()} />,
    );
    expect(screen.getByText(/ya no admite cambios/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cambiar estado/i })).not.toBeInTheDocument();
  });
});

describe("BadgeEstado", () => {
  it("anuncia la terminalidad con texto, no sólo con color", () => {
    // Regla de accesibilidad: nunca informar sólo por color.
    renderizar(<BadgeEstado entidad={ENTIDADES.SOLICITUD} estado="CUMPLIDA" />);
    expect(screen.getByText(/estado final, no se puede revertir/i)).toBeInTheDocument();
  });

  it("no marca como final un estado que todavía puede cambiar", () => {
    renderizar(<BadgeEstado entidad={ENTIDADES.SOLICITUD} estado="VENCIDA" />);
    expect(screen.queryByText(/estado final/i)).not.toBeInTheDocument();
  });

  it("muestra un guión cuando no hay estado", () => {
    renderizar(<BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
