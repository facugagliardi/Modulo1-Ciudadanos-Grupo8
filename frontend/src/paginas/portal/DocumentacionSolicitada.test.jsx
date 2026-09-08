import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentacionSolicitada } from "./DocumentacionSolicitada";
import { MisDocumentos } from "./MisDocumentos";
import { conSesion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const listarSolicitudes = vi.fn();
const cambiarEstadoSolicitud = vi.fn();
const subirDocumento = vi.fn();
const subirVersion = vi.fn();
const validarDocumento = vi.fn();
const listarDocumentos = vi.fn();

vi.mock("@/lib/api/endpoints/documentacion", async () => {
  const real = await vi.importActual("@/lib/api/endpoints/documentacion");
  return {
    // revisarArchivo es lógica pura y se prueba de verdad, no se simula.
    revisarArchivo: real.revisarArchivo,
    listarSolicitudes: (...a) => listarSolicitudes(...a),
    cambiarEstadoSolicitud: (...a) => cambiarEstadoSolicitud(...a),
    subirDocumento: (...a) => subirDocumento(...a),
    subirVersion: (...a) => subirVersion(...a),
    validarDocumento: (...a) => validarDocumento(...a),
  };
});
vi.mock("@/lib/api/endpoints/personas", () => ({
  listarDocumentos: (...a) => listarDocumentos(...a),
}));

const PENDIENTE = {
  solicitudId: 1, titularId: 1, tipoDocumento: "CERTIFICADO_DOMICILIO",
  plazo: "2099-10-15", estado: "PENDIENTE", origen: "INTERNA", documentoId: null,
};
const VENCIDA = { ...PENDIENTE, solicitudId: 2, tipoDocumento: "DNI", plazo: "2020-01-01" };
const CUMPLIDA = { ...PENDIENTE, solicitudId: 3, estado: "CUMPLIDA", documentoId: 7 };

function archivoPdf(nombre = "cert.pdf") {
  return new File([new Uint8Array(64)], nombre, { type: "application/pdf" });
}

async function elegirArchivo(archivo = archivoPdf()) {
  const input = await screen.findByLabelText("Archivo");
  await userEvent.upload(input, archivo);
  return input;
}

beforeEach(() => {
  [listarSolicitudes, cambiarEstadoSolicitud, subirDocumento, subirVersion, validarDocumento, listarDocumentos]
    .forEach((m) => m.mockReset());
  listarSolicitudes.mockResolvedValue([PENDIENTE]);
  cambiarEstadoSolicitud.mockResolvedValue({});
  subirDocumento.mockResolvedValue({ documentoId: 42 });
  listarDocumentos.mockResolvedValue([]);
  conSesion({ id: 1, rol: "PERSONA", subType: "CIUDADANO" });
});

describe("listado de lo que piden", () => {
  it("muestra el documento pedido y cuánto tiempo queda", async () => {
    renderizar(<DocumentacionSolicitada />);
    expect(await screen.findByText("Certificado de domicilio")).toBeInTheDocument();
    expect(screen.getByText(/tenés hasta el 15\/10\/2099/i)).toBeInTheDocument();
  });

  it("una solicitud vencida se destaca y aclara que todavía se puede cumplir", async () => {
    // El backend permite VENCIDA → CUMPLIDA: no tiene sentido dar por perdida
    // una solicitud sólo porque pasó el plazo.
    listarSolicitudes.mockResolvedValue([VENCIDA]);
    renderizar(<DocumentacionSolicitada />);
    expect(await screen.findByText(/venció el 01\/01\/2020/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía lo podés cumplir/i)).toBeInTheDocument();
  });

  it("separa las ya entregadas de las pendientes", async () => {
    listarSolicitudes.mockResolvedValue([PENDIENTE, CUMPLIDA]);
    renderizar(<DocumentacionSolicitada />);
    expect(await screen.findByText(/ya entregadas/i)).toBeInTheDocument();
    // El id va en su propio <span> monoespaciado, separado del texto.
    expect(screen.getByText("#7")).toBeInTheDocument();
  });

  it("avisa en positivo cuando no piden nada", async () => {
    listarSolicitudes.mockResolvedValue([]);
    renderizar(<DocumentacionSolicitada />);
    expect(await screen.findByText(/no te están pidiendo nada/i)).toBeInTheDocument();
  });
});

describe("entrega: dos pedidos encadenados en una sola acción", () => {
  it("sube el archivo y cierra la solicitud con el documentoId que devolvió", async () => {
    // Es el flujo más delicado del sistema: POST del documento y después
    // PATCH de la solicitud con el id recién creado.
    renderizar(<DocumentacionSolicitada />);
    await userEvent.click(await screen.findByRole("button", { name: /entregar/i }));
    await elegirArchivo();
    await userEvent.click(screen.getByRole("button", { name: /entregar documento/i }));

    await waitFor(() =>
      expect(subirDocumento).toHaveBeenCalledWith(1, {
        archivo: expect.any(File),
        tipoDocumento: "CERTIFICADO_DOMICILIO",
      }),
    );
    expect(cambiarEstadoSolicitud).toHaveBeenCalledWith(1, {
      estado: "CUMPLIDA",
      documentoId: 42,
    });
  });

  it("si falla la asociación, no pierde el archivo ya subido", async () => {
    // El documento quedó cargado. Pedirle a la persona que lo suba de nuevo
    // sería hacerle pagar un error nuestro.
    cambiarEstadoSolicitud.mockRejectedValueOnce(
      new ErrorApi({ status: 500, message: "Error interno" }),
    );
    renderizar(<DocumentacionSolicitada />);
    await userEvent.click(await screen.findByRole("button", { name: /entregar/i }));
    await elegirArchivo();
    await userEvent.click(screen.getByRole("button", { name: /entregar documento/i }));

    expect(await screen.findByText(/el archivo ya se subió/i)).toBeInTheDocument();
    expect(screen.getByText(/no hace falta volver a subirlo/i)).toBeInTheDocument();

    // Al reintentar no vuelve a subir: sólo asocia.
    cambiarEstadoSolicitud.mockResolvedValue({});
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() => expect(cambiarEstadoSolicitud).toHaveBeenCalledTimes(2));
    expect(subirDocumento).toHaveBeenCalledTimes(1);
  });

  it("si el documento ya estaba cargado, sólo lo asocia", async () => {
    listarDocumentos.mockResolvedValue([
      { documentoId: 9, tipoDocumento: "CERTIFICADO_DOMICILIO", version: 1 },
    ]);
    renderizar(<DocumentacionSolicitada />);
    await userEvent.click(await screen.findByRole("button", { name: /entregar/i }));

    const selector = await screen.findByLabelText(/ya lo tenías subido/i);
    await userEvent.selectOptions(selector, "9");
    await userEvent.click(screen.getByRole("button", { name: /entregar documento/i }));

    await waitFor(() =>
      expect(cambiarEstadoSolicitud).toHaveBeenCalledWith(1, {
        estado: "CUMPLIDA",
        documentoId: 9,
      }),
    );
    expect(subirDocumento).not.toHaveBeenCalled();
  });

  it("rechaza un archivo demasiado grande antes de subirlo", async () => {
    renderizar(<DocumentacionSolicitada />);
    await userEvent.click(await screen.findByRole("button", { name: /entregar/i }));
    const grande = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.pdf", {
      type: "application/pdf",
    });
    await elegirArchivo(grande);

    expect(await screen.findByText(/10 MB/)).toBeInTheDocument();
    expect(subirDocumento).not.toHaveBeenCalled();
  });

  it("rechaza una extensión que el backend no acepta", async () => {
    renderizar(<DocumentacionSolicitada />);
    await userEvent.click(await screen.findByRole("button", { name: /entregar/i }));

    // `applyAccept: false` saltea el filtro del atributo accept del input, que
    // es la primera barrera. Lo que se prueba acá es la segunda: la validación
    // propia, que es la que corre si el navegador deja pasar el archivo.
    await userEvent.upload(
      await screen.findByLabelText("Archivo"),
      new File([new Uint8Array(10)], "planilla.xlsx", { type: "text/plain" }),
      { applyAccept: false },
    );

    expect(await screen.findByText(/sólo se aceptan/i)).toBeInTheDocument();
    expect(subirDocumento).not.toHaveBeenCalled();
  });
});

describe("Mis documentos", () => {
  it("lista lo cargado con su estado de validación", async () => {
    listarDocumentos.mockResolvedValue([
      { documentoId: 1, tipoDocumento: "DNI", version: 2, vigenciaHasta: "2099-01-01",
        validadoPor: "EMPLEADO:1:RESPONSABLE_AREA", resultadoValidacion: "VALIDADO" },
    ]);
    renderizar(<MisDocumentos />);
    expect(await screen.findByText("DNI")).toBeInTheDocument();
    expect(screen.getByText("Validado")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    // La traza de auditoría se traduce, no se muestra cruda.
    expect(screen.getByText(/empleado #1/i)).toBeInTheDocument();
  });

  it("marca un documento vencido", async () => {
    listarDocumentos.mockResolvedValue([
      { documentoId: 2, tipoDocumento: "DNI", version: 1, vigenciaHasta: "2020-01-01",
        resultadoValidacion: "VALIDADO" },
    ]);
    renderizar(<MisDocumentos />);
    expect(await screen.findByText(/venció el 01\/01\/2020/i)).toBeInTheDocument();
  });

  it("el vecino no puede validar sus propios documentos", async () => {
    listarDocumentos.mockResolvedValue([
      { documentoId: 3, tipoDocumento: "DNI", version: 1, resultadoValidacion: "PENDIENTE" },
    ]);
    renderizar(<MisDocumentos />);
    await screen.findByText("DNI");
    expect(screen.queryByRole("button", { name: /^validar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subir nueva versión/i })).toBeInTheDocument();
  });

  it("explica para qué sirve la sección cuando está vacía", async () => {
    listarDocumentos.mockResolvedValue([]);
    renderizar(<MisDocumentos />);
    expect(await screen.findByText(/todavía no subiste ningún documento/i)).toBeInTheDocument();
  });
});
