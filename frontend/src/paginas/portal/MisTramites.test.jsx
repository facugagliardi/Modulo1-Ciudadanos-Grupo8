import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { MisTramites } from "./MisTramites";
import { Perfil } from "./Perfil";
import { conSesion, renderizar } from "@/pruebas/utilidades";

const obtenerCiudadano = vi.fn();
const actualizarCiudadano = vi.fn();
const listarDomicilios = vi.fn();
const listarRepresentaciones = vi.fn();
const listarSolicitudes = vi.fn();
const listarExpedientes = vi.fn();

vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  obtenerCiudadano: (...a) => obtenerCiudadano(...a),
  actualizarCiudadano: (...a) => actualizarCiudadano(...a),
}));
vi.mock("@/lib/api/endpoints/personas", () => ({
  listarDomicilios: (...a) => listarDomicilios(...a),
  listarRepresentaciones: (...a) => listarRepresentaciones(...a),
}));
vi.mock("@/lib/api/endpoints/documentacion", () => ({
  listarSolicitudes: (...a) => listarSolicitudes(...a),
}));
vi.mock("@/lib/api/endpoints/expedientes", () => ({
  listarExpedientes: (...a) => listarExpedientes(...a),
}));

const VECINO = {
  id: 1, dni: "34567890", nombre: "Diego", apellido: "Lopez",
  fechaNacimiento: "1989-04-12", cuil: "20345678901", estado: "ACTIVO",
  domicilioPrincipal: null,
  contactos: [{ contactoId: 1, tipo: "EMAIL", valor: "diego@mail.com", verificado: true }],
};
const DOMICILIO = {
  propiedadId: 3, tipo: "CASA", calle: "Rivadavia", numero: "4520", altura: null,
  esPrincipal: true, vigenteDesde: "2026-09-01", vigenteHasta: null,
};

beforeEach(() => {
  [obtenerCiudadano, actualizarCiudadano, listarDomicilios, listarRepresentaciones,
   listarSolicitudes, listarExpedientes].forEach((m) => m.mockReset());
  obtenerCiudadano.mockResolvedValue(VECINO);
  actualizarCiudadano.mockResolvedValue({});
  listarDomicilios.mockResolvedValue([DOMICILIO]);
  listarRepresentaciones.mockResolvedValue([]);
  listarSolicitudes.mockResolvedValue([]);
  listarExpedientes.mockResolvedValue([]);
  conSesion({ id: 1, rol: "PERSONA", subType: "CIUDADANO" });
});

describe("Mis trámites", () => {
  it("saluda por el nombre", async () => {
    renderizar(<MisTramites />);
    expect(await screen.findByRole("heading", { name: /hola, diego/i })).toBeInTheDocument();
  });

  it("pone primero la documentación que el municipio pide", async () => {
    listarSolicitudes.mockResolvedValue([
      { solicitudId: 1, tipoDocumento: "CERTIFICADO_DOMICILIO", plazo: "2099-01-01", estado: "PENDIENTE" },
    ]);
    renderizar(<MisTramites />);
    expect(await screen.findByText(/el municipio te pide documentación/i)).toBeInTheDocument();
    expect(screen.getByText(/CERTIFICADO DOMICILIO/i)).toBeInTheDocument();
  });

  it("destaca la solicitud vencida en lugar de mostrar la fecha a secas", async () => {
    listarSolicitudes.mockResolvedValue([
      { solicitudId: 2, tipoDocumento: "DNI", plazo: "2020-01-01", estado: "PENDIENTE" },
    ]);
    renderizar(<MisTramites />);
    expect(await screen.findByText(/venció el 01\/01\/2020/i)).toBeInTheDocument();
  });

  it("ignora las solicitudes que ya no están pendientes", async () => {
    listarSolicitudes.mockResolvedValue([
      { solicitudId: 3, tipoDocumento: "DNI", plazo: "2099-01-01", estado: "CUMPLIDA" },
    ]);
    renderizar(<MisTramites />);
    await screen.findByRole("heading", { name: /hola, diego/i });
    expect(screen.queryByText(/te pide documentación/i)).not.toBeInTheDocument();
  });

  it("avisa cuando falta el domicilio", async () => {
    listarDomicilios.mockResolvedValue([]);
    renderizar(<MisTramites />);
    expect(await screen.findByText(/todavía no cargaste tu domicilio/i)).toBeInTheDocument();
  });

  it("avisa cuando no hay forma de contactar a la persona", async () => {
    obtenerCiudadano.mockResolvedValue({ ...VECINO, contactos: [] });
    renderizar(<MisTramites />);
    expect(await screen.findByText(/no tenemos cómo avisarte nada/i)).toBeInTheDocument();
  });

  it("avisa cuando ningún contacto está verificado", async () => {
    obtenerCiudadano.mockResolvedValue({
      ...VECINO,
      contactos: [{ contactoId: 1, tipo: "EMAIL", valor: "a@b.com", verificado: false }],
    });
    renderizar(<MisTramites />);
    expect(await screen.findByText(/ninguno de tus contactos está verificado/i)).toBeInTheDocument();
  });

  it("no avisa nada cuando el legajo está completo", async () => {
    renderizar(<MisTramites />);
    await screen.findByRole("heading", { name: /hola, diego/i });
    expect(screen.queryByText(/completá tu legajo/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/no tenés nada pendiente/i)).toBeInTheDocument();
  });

  it("una persona jurídica no dispara la consulta de ciudadano, que le daría 404", async () => {
    // No existe endpoint de perfil para jurídicas: pedirlo sería un 404 seguro.
    conSesion({ id: 5, rol: "PERSONA", subType: "JURIDICA" });
    renderizar(<MisTramites />);
    await screen.findByRole("heading", { name: /mis trámites/i });
    expect(obtenerCiudadano).not.toHaveBeenCalled();
    expect(listarDomicilios).toHaveBeenCalled();
  });
});

describe("Perfil", () => {
  it("precarga los datos del vecino", async () => {
    renderizar(<Perfil />);
    expect(await screen.findByLabelText("Nombre")).toHaveValue("Diego");
    expect(screen.getByLabelText("Apellido")).toHaveValue("Lopez");
  });

  it("valida antes de mandar", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderizar(<Perfil />);
    const nombre = await screen.findByLabelText("Nombre");
    await userEvent.clear(nombre);
    await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByText(/ingresá tu nombre/i)).toBeInTheDocument();
    expect(actualizarCiudadano).not.toHaveBeenCalled();
  });

  it("guarda sólo los cinco campos que el DTO acepta", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderizar(<Perfil />);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    const enviado = await vi.waitFor(() => {
      expect(actualizarCiudadano).toHaveBeenCalled();
      return actualizarCiudadano.mock.calls[0][1];
    });
    expect(Object.keys(enviado).sort()).toEqual(
      ["apellido", "cuil", "dni", "fechaNacimiento", "nombre"].sort(),
    );
    expect(enviado).not.toHaveProperty("estado");
  });

  it("confirma que se guardó", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderizar(<Perfil />);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    expect(await screen.findByText(/datos actualizados/i)).toBeInTheDocument();
  });
});
