import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetalleExpediente } from "./DetalleExpediente";
import { conSesion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const obtenerExpediente = vi.fn();
const listarActuaciones = vi.fn();
const crearActuacion = vi.fn();
const cambiarEstadoExpediente = vi.fn();
const obtenerCiudadano = vi.fn();

vi.mock("@/lib/api/endpoints/expedientes", () => ({
  obtenerExpediente: (...a) => obtenerExpediente(...a),
  listarActuaciones: (...a) => listarActuaciones(...a),
  crearActuacion: (...a) => crearActuacion(...a),
  cambiarEstadoExpediente: (...a) => cambiarEstadoExpediente(...a),
}));
vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  obtenerCiudadano: (...a) => obtenerCiudadano(...a),
}));

const EXPEDIENTE = {
  expedienteId: 1,
  numero: "EXP-2026-000001",
  personaId: 3,
  caratula: "Habilitación comercial — kiosco de Av. Rivadavia 4520",
  areaIniciadora: "Habilitaciones",
  estado: "EN_TRAMITE",
  fechaInicio: "2026-09-06T16:47:00-03:00",
  actuacionesCount: 2,
};

const ACTUACIONES = [
  { expedienteId: 1, actuacionId: 1, tipo: "INICIO", descripcion: "Se inicia el expediente.",
    moduloOrigen: "M1", fecha: "2026-09-06T16:48:00-03:00", adjuntos: [] },
  { expedienteId: 1, actuacionId: 2, tipo: "PASE", descripcion: "Pase a Habilitaciones.",
    moduloOrigen: "Habilitaciones", fecha: "2026-09-06T16:49:00-03:00",
    adjuntos: ["https://municipio.gob.ar/ddjj.pdf"] },
];

function renderizarDetalle(zona = "admin") {
  return renderizar(<DetalleExpediente zona={zona} />, {
    ruta: `/${zona}/expedientes/1`,
    patron: `/${zona}/expedientes/:id`,
  });
}

beforeEach(() => {
  [obtenerExpediente, listarActuaciones, crearActuacion, cambiarEstadoExpediente, obtenerCiudadano]
    .forEach((m) => m.mockReset());
  obtenerExpediente.mockResolvedValue(EXPEDIENTE);
  listarActuaciones.mockResolvedValue(ACTUACIONES);
  crearActuacion.mockResolvedValue({});
  cambiarEstadoExpediente.mockResolvedValue({});
  obtenerCiudadano.mockResolvedValue({ id: 3, nombre: "Diego", apellido: "Lopez" });
  conSesion({ rol: "RESPONSABLE_AREA", subType: "EMPLEADO" });
});

describe("carátula", () => {
  it("muestra el número, el asunto y los campos del expediente", async () => {
    renderizarDetalle();
    expect(await screen.findByText("EXP-2026-000001")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /habilitación comercial/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Habilitaciones")).toBeInTheDocument();
    expect(screen.getByText("06/09/2026 16:47")).toBeInTheDocument();
  });

  it("resuelve el nombre del titular cuando llega el personaId", async () => {
    // Esta es la regresión de useRecurso: el titular se pedía con personaId
    // indefinido y quedaba en el número para siempre.
    renderizarDetalle();
    expect(await screen.findByRole("link", { name: "Diego Lopez" })).toHaveAttribute(
      "href",
      "/admin/padron/3",
    );
  });

  it("si el titular no se puede consultar, muestra su número sin romperse", async () => {
    // Pasa con las personas jurídicas: no hay endpoint para consultarlas.
    obtenerCiudadano.mockRejectedValue(new ErrorApi({ status: 404, message: "No existe" }));
    renderizarDetalle();
    await screen.findByText("EXP-2026-000001");
    expect(await screen.findByText(/Persona #3/)).toBeInTheDocument();
  });

  it("en el portal no enlaza al legajo, que el vecino no puede ver", async () => {
    conSesion({ id: 3, rol: "PERSONA", subType: "CIUDADANO" });
    renderizarDetalle("portal");
    await screen.findByText("EXP-2026-000001");
    expect(screen.queryByRole("link", { name: "Diego Lopez" })).not.toBeInTheDocument();
  });
});

describe("actuaciones", () => {
  it("las numera como fojas, con el número que devuelve el backend", async () => {
    // actuacionId es un contador por expediente: el número de foja es un dato
    // del dominio, no un índice de la lista.
    renderizarDetalle();
    expect(await screen.findByText("Inicio")).toBeInTheDocument();
    expect(screen.getByText("Pase")).toBeInTheDocument();
    expect(screen.getAllByText("01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("02").length).toBeGreaterThan(0);
  });

  it("usa el par expediente+foja como clave, porque el id se repite entre expedientes", async () => {
    // Dos expedientes distintos tienen los dos una actuación número 1.
    listarActuaciones.mockResolvedValue([
      { ...ACTUACIONES[0], expedienteId: 1, actuacionId: 1 },
      { ...ACTUACIONES[1], expedienteId: 1, actuacionId: 2 },
    ]);
    renderizarDetalle();
    await screen.findByText("Inicio");
    // Si la clave estuviera mal, React avisaría por consola de claves repetidas.
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
  });

  it("muestra los adjuntos de cada actuación", async () => {
    renderizarDetalle();
    expect(await screen.findByText(/ddjj\.pdf/)).toBeInTheDocument();
  });

  it("avisa cuando no hay ninguna", async () => {
    listarActuaciones.mockResolvedValue([]);
    renderizarDetalle();
    expect(await screen.findByText(/todavía no hay actuaciones/i)).toBeInTheDocument();
  });

  it("registra una actuación nueva", async () => {
    renderizarDetalle();
    await userEvent.click(await screen.findByRole("button", { name: /registrar actuación/i }));
    await userEvent.type(await screen.findByLabelText(/descripción/i), "Se programa la inspección.");
    await userEvent.click(screen.getByRole("button", { name: /^registrar actuación$/i }));

    await waitFor(() =>
      expect(crearActuacion).toHaveBeenCalledWith(1, {
        tipo: "PASE",
        descripcion: "Se programa la inspección.",
        moduloOrigen: "M1",
        adjuntos: [],
      }),
    );
  });

  it("parte los adjuntos por línea", async () => {
    renderizarDetalle();
    await userEvent.click(await screen.findByRole("button", { name: /registrar actuación/i }));
    await userEvent.type(await screen.findByLabelText(/descripción/i), "Con adjuntos.");
    await userEvent.type(screen.getByLabelText(/adjuntos/i), "uno.pdf{enter}dos.pdf");
    await userEvent.click(screen.getByRole("button", { name: /^registrar actuación$/i }));

    await waitFor(() =>
      expect(crearActuacion.mock.calls[0][1].adjuntos).toEqual(["uno.pdf", "dos.pdf"]),
    );
  });

  it("exige la descripción", async () => {
    renderizarDetalle();
    await userEvent.click(await screen.findByRole("button", { name: /registrar actuación/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^registrar actuación$/i }));

    expect(await screen.findByText(/contá qué se hizo/i)).toBeInTheDocument();
    expect(crearActuacion).not.toHaveBeenCalled();
  });

  it("un expediente archivado no admite actuaciones nuevas", async () => {
    // El backend responde 409; es mejor no ofrecer el botón.
    obtenerExpediente.mockResolvedValue({ ...EXPEDIENTE, estado: "ARCHIVADO" });
    renderizarDetalle();
    await screen.findByText("EXP-2026-000001");

    expect(screen.queryByRole("button", { name: /registrar actuación/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no admite nuevas actuaciones/i)).toBeInTheDocument();
  });

  it("el vecino ve la historia pero no puede escribir en ella", async () => {
    conSesion({ id: 3, rol: "PERSONA", subType: "CIUDADANO" });
    renderizarDetalle("portal");
    await screen.findByText("Inicio");
    expect(screen.queryByRole("button", { name: /registrar actuación/i })).not.toBeInTheDocument();
  });
});

describe("cambio de estado", () => {
  it("no deja resolver un expediente sin actuaciones", async () => {
    // Regla del alcance que el backend no valida: "no pasa a RESUELTO sin al
    // menos una actuación".
    listarActuaciones.mockResolvedValue([]);
    obtenerExpediente.mockResolvedValue({ ...EXPEDIENTE, actuacionesCount: 0 });
    renderizarDetalle();
    await userEvent.click(await screen.findByRole("button", { name: /cambiar estado/i }));

    const opcion = await screen.findByRole("radio", { name: /resuelto/i });
    expect(opcion).toBeDisabled();
    expect(screen.getByText(/necesita al menos una actuación/i)).toBeInTheDocument();
  });

  it("con actuaciones sí lo permite", async () => {
    renderizarDetalle();
    await userEvent.click(await screen.findByRole("button", { name: /cambiar estado/i }));

    const opcion = await screen.findByRole("radio", { name: /resuelto/i });
    expect(opcion).toBeEnabled();
    await userEvent.click(opcion);
    await userEvent.click(screen.getByRole("button", { name: /confirmar cambio/i }));

    await waitFor(() => expect(cambiarEstadoExpediente).toHaveBeenCalledWith(1, "RESUELTO"));
  });

  it("archivar avisa que no se puede deshacer", async () => {
    renderizarDetalle();
    await userEvent.click(await screen.findByRole("button", { name: /cambiar estado/i }));
    await userEvent.click(await screen.findByRole("radio", { name: /archivado/i }));

    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(/estado final/i);
  });

  it("el auditor no puede cambiar el estado", async () => {
    conSesion({ rol: "AUDITOR", subType: "EMPLEADO" });
    renderizarDetalle();
    await screen.findByText("EXP-2026-000001");
    expect(screen.queryByRole("button", { name: /cambiar estado/i })).not.toBeInTheDocument();
  });
});
