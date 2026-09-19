import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Expedientes } from "./Expedientes";
import { NuevoExpediente } from "./NuevoExpediente";
import { MisExpedientes } from "../portal/MisExpedientes";
import { conSesion, renderizar } from "@/pruebas/utilidades";

const navegar = vi.fn();
vi.mock("react-router-dom", async () => {
  const real = await vi.importActual("react-router-dom");
  return { ...real, useNavigate: () => navegar };
});

const listarExpedientes = vi.fn();
const crearExpediente = vi.fn();
const buscarPorDni = vi.fn();

vi.mock("@/lib/api/endpoints/expedientes", () => ({
  listarExpedientes: (...a) => listarExpedientes(...a),
  crearExpediente: (...a) => crearExpediente(...a),
}));
vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  buscarPorDni: (...a) => buscarPorDni(...a),
}));

const LISTA = [
  { expedienteId: 1, numero: "EXP-2026-000001", personaId: 3, caratula: "Habilitación comercial",
    areaIniciadora: "Habilitaciones", estado: "EN_TRAMITE",
    fechaInicio: "2026-09-06T16:47:00-03:00", actuacionesCount: 2 },
  { expedienteId: 2, numero: "EXP-2026-000002", personaId: 4, caratula: "Reclamo por bache",
    areaIniciadora: "Obras", estado: "INICIADO",
    fechaInicio: "2026-09-05T10:00:00-03:00", actuacionesCount: 0 },
  { expedienteId: 3, numero: "EXP-2025-000099", personaId: 3, caratula: "Exención de tasa",
    areaIniciadora: "Rentas", estado: "ARCHIVADO",
    fechaInicio: "2025-11-02T09:00:00-03:00", actuacionesCount: 5 },
];

beforeEach(() => {
  navegar.mockClear();
  [listarExpedientes, crearExpediente, buscarPorDni].forEach((m) => m.mockReset());
  listarExpedientes.mockResolvedValue(LISTA);
  crearExpediente.mockResolvedValue({ expedienteId: 9, numero: "EXP-2026-000009" });
  buscarPorDni.mockResolvedValue({ existe: true, id: 3, nombre: "Diego", apellido: "Lopez", estado: "ACTIVO" });
  conSesion({ rol: "RESPONSABLE_AREA", subType: "EMPLEADO" });
});

describe("listado del backoffice", () => {
  it("muestra los expedientes con su número en monoespaciada", async () => {
    renderizar(<Expedientes />);
    expect(await screen.findByText("EXP-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Reclamo por bache")).toBeInTheDocument();
  });

  it("arma el filtro de áreas con las que realmente aparecen", async () => {
    // areaIniciadora es texto libre en el backend: no hay lista fija que copiar.
    renderizar(<Expedientes />);
    await screen.findByText("EXP-2026-000001");
    const filtro = screen.getByLabelText("Área");
    const opciones = [...within(filtro).getAllByRole("option")].map((o) => o.textContent);
    expect(opciones).toEqual(["Todos", "Habilitaciones", "Obras", "Rentas"]);
  });

  it("filtra por área", async () => {
    renderizar(<Expedientes />);
    await screen.findByText("EXP-2026-000001");
    await userEvent.selectOptions(screen.getByLabelText("Área"), "Obras");

    expect(screen.getByText("Reclamo por bache")).toBeInTheDocument();
    expect(screen.queryByText("Habilitación comercial")).not.toBeInTheDocument();
  });

  it("señala cuántos expedientes están sin ninguna actuación", async () => {
    // Trabajo estancado: un expediente abierto sobre el que nadie hizo nada.
    renderizar(<Expedientes />);
    expect(await screen.findByText(/1 sin ninguna actuación/i)).toBeInTheDocument();
  });

  it("no cuenta como estancado un expediente archivado", async () => {
    listarExpedientes.mockResolvedValue([
      { ...LISTA[2], actuacionesCount: 0 },
    ]);
    renderizar(<Expedientes />);
    await screen.findByText("EXP-2025-000099");
    expect(screen.queryByText(/sin ninguna actuación/i)).not.toBeInTheDocument();
  });

  it("enlaza cada fila a su carátula", async () => {
    renderizar(<Expedientes />);
    expect(await screen.findByRole("link", { name: "EXP-2026-000001" })).toHaveAttribute(
      "href",
      "/admin/expedientes/1",
    );
  });

  it("el auditor no ve la acción de iniciar", async () => {
    conSesion({ rol: "AUDITOR", subType: "EMPLEADO" });
    renderizar(<Expedientes />);
    await screen.findByText("EXP-2026-000001");
    expect(screen.queryByRole("link", { name: /iniciar expediente/i })).not.toBeInTheDocument();
  });
});

describe("alta de expediente", () => {
  it("busca al titular por DNI antes de pedir la carátula", async () => {
    renderizar(<NuevoExpediente />);
    expect(screen.getByLabelText(/dni del titular/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Carátula")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/dni del titular/i), "34567890");
    await userEvent.click(screen.getByRole("button", { name: /buscar titular/i }));

    expect(await screen.findByText("Diego Lopez")).toBeInTheDocument();
    expect(screen.getByLabelText("Carátula")).toBeInTheDocument();
  });

  it("avisa si el titular no está registrado", async () => {
    buscarPorDni.mockResolvedValue({ existe: false });
    renderizar(<NuevoExpediente />);
    await userEvent.type(screen.getByLabelText(/dni del titular/i), "99999999");
    await userEvent.click(screen.getByRole("button", { name: /buscar titular/i }));

    expect(await screen.findByText(/tiene que registrarse antes/i)).toBeInTheDocument();
  });

  it("advierte si el titular figura como fallecido", async () => {
    buscarPorDni.mockResolvedValue({ existe: true, id: 7, nombre: "Juan", apellido: "Pérez", estado: "FALLECIDO" });
    renderizar(<NuevoExpediente />);
    await userEvent.type(screen.getByLabelText(/dni del titular/i), "12345678");
    await userEvent.click(screen.getByRole("button", { name: /buscar titular/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/figura como fallecida/i);
  });

  it("exige carátula y área", async () => {
    renderizar(<NuevoExpediente />);
    await userEvent.type(screen.getByLabelText(/dni del titular/i), "34567890");
    await userEvent.click(screen.getByRole("button", { name: /buscar titular/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^iniciar expediente$/i }));

    expect(await screen.findByText(/escribí la carátula/i)).toBeInTheDocument();
    expect(screen.getByText(/indicá el área/i)).toBeInTheDocument();
    expect(crearExpediente).not.toHaveBeenCalled();
  });

  it("no manda número: lo genera el backend", async () => {
    renderizar(<NuevoExpediente />);
    await userEvent.type(screen.getByLabelText(/dni del titular/i), "34567890");
    await userEvent.click(screen.getByRole("button", { name: /buscar titular/i }));
    await userEvent.type(await screen.findByLabelText("Carátula"), "Habilitación comercial");
    await userEvent.type(screen.getByLabelText(/área iniciadora/i), "Habilitaciones");
    await userEvent.click(screen.getByRole("button", { name: /^iniciar expediente$/i }));

    await vi.waitFor(() => expect(crearExpediente).toHaveBeenCalled());
    const enviado = crearExpediente.mock.calls[0][0];
    expect(enviado).toEqual({
      personaId: 3,
      caratula: "Habilitación comercial",
      areaIniciadora: "Habilitaciones",
    });
    expect(enviado).not.toHaveProperty("numero");
    expect(navegar).toHaveBeenCalledWith("/admin/expedientes/9", { replace: true });
  });
});

describe("listado del vecino", () => {
  it("no usa tabla: muestra tarjetas", async () => {
    conSesion({ id: 3, rol: "PERSONA", subType: "CIUDADANO" });
    renderizar(<MisExpedientes />);
    await screen.findByText("Habilitación comercial");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("resume el estado y el conteo de actuaciones", async () => {
    conSesion({ id: 3, rol: "PERSONA", subType: "CIUDADANO" });
    renderizar(<MisExpedientes />);
    expect(await screen.findByText(/2 actuaciones/)).toBeInTheDocument();
    expect(screen.getByText(/0 actuaciones/)).toBeInTheDocument();
  });

  it("explica quién abre los expedientes cuando no hay ninguno", async () => {
    listarExpedientes.mockResolvedValue([]);
    conSesion({ id: 3, rol: "PERSONA", subType: "CIUDADANO" });
    renderizar(<MisExpedientes />);
    expect(await screen.findByText(/no tenés expedientes/i)).toBeInTheDocument();
    expect(screen.getByText(/los inicia el municipio/i)).toBeInTheDocument();
  });
});
