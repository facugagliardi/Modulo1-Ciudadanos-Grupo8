import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResolucionObra } from "./ResolucionObra";
import { resolverObra } from "@/lib/api/endpoints/expedientes";

vi.mock("@/lib/api/endpoints/expedientes", () => ({ resolverObra: vi.fn() }));
const expediente = { expedienteId: 4, estado: "EN_TRAMITE" };
beforeEach(() => { vi.clearAllMocks(); resolverObra.mockResolvedValue({}); });

describe("dictamen de obra", () => {
  it("exige resultado y resumen y conserva el dictamen al fallar el envio", async () => {
    const user = userEvent.setup(); const alGuardar = vi.fn();
    resolverObra.mockRejectedValueOnce(new Error("Sin conexión"));
    render(<ResolucionObra expediente={expediente} alGuardar={alGuardar} />);
    await user.click(screen.getByRole("button", { name: "Resolver expediente de obra" }));
    await user.click(screen.getByRole("button", { name: "Registrar resolución" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elegí el resultado");
    expect(resolverObra).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "Rechazado" }));
    await user.type(screen.getByLabelText("Resumen del dictamen"), "  No cumple los requisitos  ");
    await user.click(screen.getByRole("button", { name: "Registrar resolución" }));
    await waitFor(() => expect(resolverObra).toHaveBeenCalledWith(4, { resultado: "rejected", resumen: "No cumple los requisitos" }));
    expect(alGuardar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Resumen del dictamen")).toHaveValue("  No cumple los requisitos  ");
    await user.click(screen.getByRole("button", { name: "Registrar resolución" }));
    await waitFor(() => expect(alGuardar).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("muestra una resolucion guardada incluso despues de archivar", () => {
    render(<ResolucionObra expediente={{ ...expediente, estado: "ARCHIVADO", resolucionObra: "approved", resumenResolucionObra: "Dictamen favorable" }} />);
    expect(screen.getByRole("heading", { name: /aprobada/ })).toBeInTheDocument();
    expect(screen.getByText("Dictamen favorable")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("no permite resolver antes del pase a tramite", () => {
    render(<ResolucionObra expediente={{ ...expediente, estado: "INICIADO" }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
