import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListaDocumentos, RevisarDocumento } from "./ListaDocumentos";
import { escribirFecha, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const validarDocumento = vi.fn();
const crearSolicitud = vi.fn();
const obtenerArchivoDocumento = vi.fn();
const obtenerDocumento = vi.fn();

vi.mock("@/lib/api/endpoints/documentacion", async () => {
  const real = await vi.importActual("@/lib/api/endpoints/documentacion");
  return {
    revisarArchivo: real.revisarArchivo,
    subirDocumento: vi.fn(),
    subirVersion: vi.fn(),
    validarDocumento: (...a) => validarDocumento(...a),
    crearSolicitud: (...a) => crearSolicitud(...a),
    obtenerArchivoDocumento: (...a) => obtenerArchivoDocumento(...a),
    obtenerDocumento: (...a) => obtenerDocumento(...a),
  };
});

const PENDIENTE = {
  documentoId: 7,
  tipoDocumento: "CERTIFICADO_DOMICILIO",
  version: 1,
  resultadoValidacion: "PENDIENTE",
  vigenciaHasta: null,
};
const VALIDADO = { ...PENDIENTE, documentoId: 8, resultadoValidacion: "VALIDADO" };

const alCambiar = vi.fn();

function pintar(documentos = [PENDIENTE], props = {}) {
  return renderizar(
    <ListaDocumentos
      personaId={1}
      documentos={documentos}
      puedeValidar
      alCambiar={alCambiar}
      {...props}
    />,
  );
}

beforeEach(() => {
  [validarDocumento, crearSolicitud, obtenerArchivoDocumento, obtenerDocumento, alCambiar]
    .forEach((m) => m.mockReset());
  obtenerDocumento.mockResolvedValue({ ...PENDIENTE, personaId: 1 });
  validarDocumento.mockResolvedValue({});
  crearSolicitud.mockResolvedValue({ solicitudId: 99 });
  obtenerArchivoDocumento.mockResolvedValue(new Blob(["x"], { type: "application/pdf" }));
});

async function abrirRevision() {
  await userEvent.click(await screen.findByRole("button", { name: /revisar/i }));
  await screen.findByText("Resultado");
}

describe("visor", () => {
  it("un PDF se muestra embebido", async () => {
    obtenerArchivoDocumento.mockResolvedValue(new Blob(["x"], { type: "application/pdf" }));
    pintar();
    await abrirRevision();

    const marco = await screen.findByTitle("Documento");
    expect(marco.tagName).toBe("IFRAME");
    expect(obtenerArchivoDocumento).toHaveBeenCalledWith(7, expect.anything());
  });

  it("una foto se muestra como imagen", async () => {
    // El ciudadano sube fotos del documento tanto como PDFs: el visor tiene
    // que resolver los dos sin que nadie elija nada.
    obtenerArchivoDocumento.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));
    pintar();
    await abrirRevision();

    expect(await screen.findByRole("img", { name: /documento cargado/i })).toBeInTheDocument();
  });

  it("si el archivo ya no está en el servidor lo dice, en vez de mostrar un cuadro vacío", async () => {
    obtenerArchivoDocumento.mockRejectedValue(new ErrorApi({ status: 404, message: "no está" }));
    pintar();
    await abrirRevision();

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya no está en el servidor/i);
  });
});

describe("decisión", () => {
  it("aprueba con la vigencia elegida", async () => {
    pintar();
    await abrirRevision();
    await escribirFecha("Vigente hasta", "2099-12-31");
    await userEvent.click(screen.getByRole("button", { name: /aprobar documento/i }));

    await waitFor(() =>
      expect(validarDocumento).toHaveBeenCalledWith(7, {
        aprobado: true,
        vigenciaHasta: "2099-12-31",
      }),
    );
    expect(crearSolicitud).not.toHaveBeenCalled();
  });

  it("rechaza sin abrir ninguna solicitud", async () => {
    pintar();
    await abrirRevision();
    await userEvent.click(screen.getByRole("radio", { name: /rechazar/i }));
    await userEvent.click(screen.getByRole("button", { name: /rechazar documento/i }));

    await waitFor(() =>
      expect(validarDocumento).toHaveBeenCalledWith(7, {
        aprobado: false,
        vigenciaHasta: undefined,
      }),
    );
    expect(crearSolicitud).not.toHaveBeenCalled();
  });

  /**
   * "Volver a pedir" NO reabre la solicitud original: en el modelo, CUMPLIDA
   * es terminal. Rechaza y abre una solicitud nueva, que es lo que de verdad
   * pasó -- la primera se cumplió, con un documento que no servía.
   */
  it("al volver a pedir, rechaza y abre una solicitud nueva", async () => {
    const orden = [];
    validarDocumento.mockImplementation(async () => orden.push("validar"));
    crearSolicitud.mockImplementation(async () => orden.push("solicitar"));

    pintar();
    await abrirRevision();
    await userEvent.click(screen.getByRole("radio", { name: /volver a pedir/i }));
    await escribirFecha("Nuevo plazo", "2099-11-30");
    await userEvent.click(screen.getByRole("button", { name: /rechazar y volver a pedir/i }));

    await waitFor(() => expect(crearSolicitud).toHaveBeenCalled());
    expect(validarDocumento).toHaveBeenCalledWith(7, { aprobado: false, vigenciaHasta: undefined });
    expect(crearSolicitud).toHaveBeenCalledWith({
      titularId: 1,
      tipoDocumento: "CERTIFICADO_DOMICILIO",
      plazo: "2099-11-30",
      origen: "INTERNA",
    });
    // Primero rechazar: si se crea la solicitud y despues falla el rechazo,
    // el titular recibe un pedido por un documento que sigue sin resolverse.
    expect(orden).toEqual(["validar", "solicitar"]);
  });

  it("volver a pedir exige un plazo antes de tocar el backend", async () => {
    pintar();
    await abrirRevision();
    await userEvent.click(screen.getByRole("radio", { name: /volver a pedir/i }));
    await userEvent.click(screen.getByRole("button", { name: /rechazar y volver a pedir/i }));

    expect(await screen.findByText(/indicá para cuándo/i)).toBeInTheDocument();
    expect(validarDocumento).not.toHaveBeenCalled();
    expect(crearSolicitud).not.toHaveBeenCalled();
  });

  it("si el rechazo entró pero la solicitud falló, lo dice", async () => {
    // Las dos llamadas no son atómicas. Callar el estado intermedio dejaría a
    // alguien creyendo que no pasó nada, cuando el documento ya está rechazado.
    crearSolicitud.mockRejectedValue(new ErrorApi({ status: 500, message: "boom" }));

    pintar();
    await abrirRevision();
    await userEvent.click(screen.getByRole("radio", { name: /volver a pedir/i }));
    await escribirFecha("Nuevo plazo", "2099-11-30");
    await userEvent.click(screen.getByRole("button", { name: /rechazar y volver a pedir/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/quedó rechazado/i);
  });
});

describe("entrando por el id, desde la pantalla de Documentación", () => {
  it("trae el documento y deja resolverlo igual que desde el legajo", async () => {
    // Una solicitud sólo conoce el `documentoId`: el resto hay que buscarlo,
    // porque de eso depende si todavía se puede decidir algo.
    obtenerDocumento.mockResolvedValue({ ...PENDIENTE, personaId: 1 });

    renderizar(
      <RevisarDocumento
        personaId={1}
        documentoId={7}
        puedeValidar
        alGuardar={alCambiar}
        disparador={<button type="button">Revisar</button>}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Revisar" }));

    expect(await screen.findByText("Resultado")).toBeInTheDocument();
    expect(obtenerDocumento).toHaveBeenCalledWith(7);

    await userEvent.click(screen.getByRole("button", { name: /aprobar documento/i }));
    await waitFor(() => expect(validarDocumento).toHaveBeenCalledWith(7, expect.anything()));
  });

  it("un documento ya resuelto se abre sólo para mirar", async () => {
    obtenerDocumento.mockResolvedValue({ ...VALIDADO, documentoId: 7, personaId: 1 });

    renderizar(
      <RevisarDocumento
        personaId={1}
        documentoId={7}
        puedeValidar
        disparador={<button type="button">Ver</button>}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Ver" }));

    expect(await screen.findByTitle("Documento")).toBeInTheDocument();
    expect(screen.queryByText("Resultado")).not.toBeInTheDocument();
  });
});

describe("quién decide", () => {
  it("un documento ya resuelto se puede mirar pero no volver a decidir", async () => {
    pintar([VALIDADO]);
    await userEvent.click(await screen.findByRole("button", { name: /ver/i }));

    expect(await screen.findByTitle("Documento")).toBeInTheDocument();
    expect(screen.queryByText("Resultado")).not.toBeInTheDocument();
  });

  it("sin permiso para validar, el titular igual puede ver lo que subió", async () => {
    // Antes subía un archivo y no lo veía nunca más.
    pintar([PENDIENTE], { puedeValidar: false });
    await userEvent.click(await screen.findByRole("button", { name: /ver/i }));

    expect(await screen.findByTitle("Documento")).toBeInTheDocument();
    expect(screen.queryByText("Resultado")).not.toBeInTheDocument();
  });
});
