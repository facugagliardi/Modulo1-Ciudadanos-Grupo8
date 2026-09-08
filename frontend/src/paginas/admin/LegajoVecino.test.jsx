import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LegajoVecino } from "./LegajoVecino";
import { conSesion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const obtenerCiudadano = vi.fn();
const cambiarEstadoCiudadano = vi.fn();
const listarDomicilios = vi.fn();
const listarRelaciones = vi.fn();
const listarDocumentos = vi.fn();

vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  obtenerCiudadano: (...a) => obtenerCiudadano(...a),
  cambiarEstadoCiudadano: (...a) => cambiarEstadoCiudadano(...a),
}));
vi.mock("@/lib/api/endpoints/personas", () => ({
  listarDomicilios: (...a) => listarDomicilios(...a),
  listarDocumentos: (...a) => listarDocumentos(...a),
}));
vi.mock("@/lib/api/endpoints/relaciones", () => ({
  listarRelaciones: (...a) => listarRelaciones(...a),
}));

const VECINO = {
  id: 3,
  dni: "34567890",
  nombre: "Diego",
  apellido: "Lopez",
  fechaNacimiento: "1989-04-12",
  cuil: "20345678901",
  estado: "ACTIVO",
  domicilioPrincipal: {
    propiedadId: 2,
    tipo: "CASA",
    calle: "Siempreviva",
    numero: "742",
    vigenteDesde: "2020-01-01",
  },
  contactos: [
    { contactoId: 1, tipo: "EMAIL", valor: "diego@mail.com", verificado: true },
    { contactoId: 2, tipo: "TELEFONO", valor: "+541144445555", verificado: false },
  ],
};

const DOMICILIOS = [
  {
    propiedadId: 3,
    tipo: "DEPARTAMENTO",
    calle: "Corrientes",
    numero: "1500",
    altura: "3B",
    esPrincipal: true,
    vigenteDesde: "2026-03-01",
    vigenteHasta: null,
  },
  {
    propiedadId: 2,
    tipo: "CASA",
    calle: "Siempreviva",
    numero: "742",
    esPrincipal: false,
    vigenteDesde: "2020-01-01",
    vigenteHasta: "2026-03-01",
  },
];

function renderizarLegajo() {
  return renderizar(<LegajoVecino />, { ruta: "/admin/padron/3", patron: "/admin/padron/:id" });
}

beforeEach(() => {
  [obtenerCiudadano, cambiarEstadoCiudadano, listarDomicilios, listarRelaciones, listarDocumentos]
    .forEach((m) => m.mockReset());
  obtenerCiudadano.mockResolvedValue(VECINO);
  listarDomicilios.mockResolvedValue(DOMICILIOS);
  listarDocumentos.mockResolvedValue([]);
  listarRelaciones.mockResolvedValue([
    {
      relacionId: 1,
      ciudadanoRelacionadoId: 5,
      nombre: "Ana",
      apellido: "Lopez",
      tipoRelacion: "HIJA",
      esResponsable: true,
    },
  ]);
  cambiarEstadoCiudadano.mockResolvedValue({});
});

describe("cabecera del legajo", () => {
  it("muestra el nombre, los identificadores y el estado", async () => {
    conSesion();
    renderizarLegajo();

    expect(await screen.findByRole("heading", { name: /diego lopez/i })).toBeInTheDocument();
    expect(screen.getAllByText("34.567.890").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20-34567890-1").length).toBeGreaterThan(0);
  });
});

describe("pestañas", () => {
  it("muestra los datos personales con la edad calculada", async () => {
    conSesion();
    renderizarLegajo();
    expect(await screen.findByText(/12\/04\/1989/)).toBeInTheDocument();
  });

  it("apila la historia de domicilios en vez de pisarla", async () => {
    // El domicilio no se modifica: se cierra el vigente y se abre uno nuevo.
    conSesion();
    renderizarLegajo();
    await screen.findByRole("heading", { name: /diego lopez/i });

    await userEvent.click(screen.getByRole("tab", { name: /domicilios/i }));

    expect(await screen.findByText(/Corrientes 1500, 3B/)).toBeInTheDocument();
    expect(screen.getByText(/Siempreviva 742/)).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    // El histórico muestra el rango cerrado.
    expect(screen.getByText(/01\/01\/2020 — 01\/03\/2026/)).toBeInTheDocument();
  });

  it("distingue el contacto verificado del que no lo está", async () => {
    conSesion();
    renderizarLegajo();
    await screen.findByRole("heading", { name: /diego lopez/i });

    await userEvent.click(screen.getByRole("tab", { name: /contacto/i }));

    expect(await screen.findByText("Verificado")).toBeInTheDocument();
    expect(screen.getByText("Sin verificar")).toBeInTheDocument();
  });

  it("marca quién es responsable en el grupo familiar", async () => {
    conSesion();
    renderizarLegajo();
    await screen.findByRole("heading", { name: /diego lopez/i });

    await userEvent.click(screen.getByRole("tab", { name: /grupo familiar/i }));

    expect(await screen.findByRole("link", { name: "Ana Lopez" })).toHaveAttribute(
      "href",
      "/admin/padron/5",
    );
    expect(screen.getByText("Responsable")).toBeInTheDocument();
  });

  it("avisa cuando no hay vínculos cargados", async () => {
    listarRelaciones.mockResolvedValue([]);
    conSesion();
    renderizarLegajo();
    await screen.findByRole("heading", { name: /diego lopez/i });

    await userEvent.click(screen.getByRole("tab", { name: /grupo familiar/i }));
    expect(await screen.findByText(/sin vínculos registrados/i)).toBeInTheDocument();
  });
});

describe("resistencia a fallas parciales", () => {
  it("si fallan los domicilios, el resto del legajo se sigue viendo", async () => {
    // Cada bloque se carga por separado justamente para esto.
    listarDomicilios.mockRejectedValue(new ErrorApi({ status: 500, message: "Error interno" }));
    conSesion();
    renderizarLegajo();

    expect(await screen.findByRole("heading", { name: /diego lopez/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /domicilios/i }));
    expect(await screen.findByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("si falla la persona, muestra el error y no una pantalla en blanco", async () => {
    obtenerCiudadano.mockRejectedValue(new ErrorApi({ status: 404, message: "No existe" }));
    conSesion();
    renderizarLegajo();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no existe/i);
  });
});

describe("cambio de estado según el rol", () => {
  it("el responsable de área puede cambiarlo", async () => {
    conSesion({ rol: "RESPONSABLE_AREA" });
    renderizarLegajo();
    await screen.findByRole("heading", { name: /diego lopez/i });

    await userEvent.click(screen.getByRole("button", { name: /cambiar estado/i }));
    await userEvent.click(await screen.findByRole("radio", { name: /^inactivo$/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar cambio/i }));

    await waitFor(() => expect(cambiarEstadoCiudadano).toHaveBeenCalledWith(3, "INACTIVO"));
  });

  it("el administrativo no ve la acción: le daría 403", async () => {
    // CAMBIAR_ESTADO_TITULAR es sólo del responsable de área.
    conSesion({ rol: "ADMINISTRATIVO" });
    renderizarLegajo();
    await screen.findByRole("heading", { name: /diego lopez/i });

    expect(screen.queryByRole("button", { name: /cambiar estado/i })).not.toBeInTheDocument();
  });

  it("el auditor tampoco", async () => {
    conSesion({ rol: "AUDITOR" });
    renderizarLegajo();
    await screen.findByRole("heading", { name: /diego lopez/i });

    expect(screen.queryByRole("button", { name: /cambiar estado/i })).not.toBeInTheDocument();
  });
});
