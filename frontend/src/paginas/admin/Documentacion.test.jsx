import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Documentacion } from "./Documentacion";
import { conSesion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const listarSolicitudes = vi.fn();
const crearSolicitud = vi.fn();
const cambiarEstadoSolicitud = vi.fn();
const buscarPorDni = vi.fn();

vi.mock("@/lib/api/endpoints/documentacion", () => ({
  listarSolicitudes: (...a) => listarSolicitudes(...a),
  crearSolicitud: (...a) => crearSolicitud(...a),
  cambiarEstadoSolicitud: (...a) => cambiarEstadoSolicitud(...a),
}));
vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  buscarPorDni: (...a) => buscarPorDni(...a),
}));

const SOLICITUDES = [
  { solicitudId: 1, titularId: 1, tipoDocumento: "CERTIFICADO_DOMICILIO",
    plazo: "2099-10-15", estado: "PENDIENTE", origen: "INTERNA" },
  { solicitudId: 2, titularId: 2, tipoDocumento: "DNI",
    plazo: "2020-01-01", estado: "PENDIENTE", origen: "EVENTO" },
  { solicitudId: 3, titularId: 1, tipoDocumento: "PODER",
    plazo: "2099-01-01", estado: "CUMPLIDA", origen: "INTERNA" },
];

beforeEach(() => {
  [listarSolicitudes, crearSolicitud, cambiarEstadoSolicitud, buscarPorDni].forEach((m) => m.mockReset());
  listarSolicitudes.mockResolvedValue(SOLICITUDES);
  crearSolicitud.mockResolvedValue({ solicitudId: 9 });
  cambiarEstadoSolicitud.mockResolvedValue({});
  buscarPorDni.mockResolvedValue({ existe: true, id: 3, nombre: "Diego", apellido: "Lopez", estado: "ACTIVO" });
  conSesion({ rol: "RESPONSABLE_AREA", subType: "EMPLEADO" });
});

describe("listado de solicitudes", () => {
  it("muestra qué se pidió, a quién y con qué plazo", async () => {
    renderizar(<Documentacion />);
    expect(await screen.findByText("Certificado de domicilio")).toBeInTheDocument();
    // Dos solicitudes son del titular 1, así que hay dos enlaces iguales.
    expect(screen.getAllByRole("link", { name: "#1" })[0]).toHaveAttribute(
      "href",
      "/admin/padron/1",
    );
  });

  it("marca las pendientes cuyo plazo ya pasó", async () => {
    renderizar(<Documentacion />);
    expect(await screen.findByText(/· vencido/i)).toBeInTheDocument();
    expect(screen.getByText(/1 con el plazo vencido/i)).toBeInTheDocument();
  });

  it("no cuenta como vencida una que ya se cumplió", async () => {
    listarSolicitudes.mockResolvedValue([
      { ...SOLICITUDES[1], estado: "CUMPLIDA" },
    ]);
    renderizar(<Documentacion />);
    await screen.findByText("DNI");
    expect(screen.queryByText(/con el plazo vencido/i)).not.toBeInTheDocument();
  });

  it("filtra por origen", async () => {
    renderizar(<Documentacion />);
    await screen.findByText("Certificado de domicilio");
    await userEvent.selectOptions(screen.getByLabelText("Origen"), "EVENTO");

    expect(screen.getByText("DNI")).toBeInTheDocument();
    expect(screen.queryByText("Certificado de domicilio")).not.toBeInTheDocument();
  });

  it("explica dónde se valida, porque no hay bandeja global", async () => {
    // El backend no tiene listado global de documentos: sólo por persona.
    renderizar(<Documentacion />);
    expect(await screen.findByText(/entrá a su legajo desde el padrón/i)).toBeInTheDocument();
  });
});

describe("cambio de estado de una solicitud", () => {
  it("no deja cumplirla desde acá: la cumple el titular al entregar", async () => {
    // Pasar a CUMPLIDA exige el documentoId, que sale del portal del vecino.
    renderizar(<Documentacion />);
    await screen.findByText("Certificado de domicilio");
    await userEvent.click(screen.getAllByRole("button", { name: "Estado" })[0]);

    const cumplida = await screen.findByRole("radio", { name: /cumplida/i });
    expect(cumplida).toBeDisabled();
    expect(screen.getByText(/la cumple el titular al entregar/i)).toBeInTheDocument();
  });

  it("sí permite darla por vencida", async () => {
    renderizar(<Documentacion />);
    await screen.findByText("Certificado de domicilio");
    await userEvent.click(screen.getAllByRole("button", { name: "Estado" })[0]);
    await userEvent.click(await screen.findByRole("radio", { name: /vencida/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar cambio/i }));

    await waitFor(() =>
      expect(cambiarEstadoSolicitud).toHaveBeenCalledWith(1, { estado: "VENCIDA" }),
    );
  });

  it("una solicitud cumplida no ofrece cambios: es terminal", async () => {
    listarSolicitudes.mockResolvedValue([SOLICITUDES[2]]);
    renderizar(<Documentacion />);
    await screen.findByText("Poder");
    expect(screen.queryByRole("button", { name: "Estado" })).not.toBeInTheDocument();
  });
});

describe("pedir documentación", () => {
  it("busca al titular por DNI antes de pedir el resto", async () => {
    renderizar(<Documentacion />);
    await userEvent.click(await screen.findByRole("button", { name: /pedir documentación/i }));

    expect(await screen.findByLabelText(/dni del titular/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/dni del titular/i), "34567890");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText("Diego Lopez")).toBeInTheDocument();
    expect(screen.getByLabelText("Plazo")).toBeInTheDocument();
  });

  it("rechaza un plazo en el pasado antes de llamar al backend", async () => {
    // El backend devuelve 400: es mejor decirlo en el formulario.
    renderizar(<Documentacion />);
    await userEvent.click(await screen.findByRole("button", { name: /pedir documentación/i }));
    await userEvent.type(await screen.findByLabelText(/dni del titular/i), "34567890");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    const plazo = await screen.findByLabelText("Plazo");
    await userEvent.type(plazo, "2020-01-01");
    await userEvent.click(screen.getByRole("button", { name: /^pedir documentación$/i }));

    expect(await screen.findByText(/posterior a hoy/i)).toBeInTheDocument();
    expect(crearSolicitud).not.toHaveBeenCalled();
  });

  it("exige el plazo", async () => {
    renderizar(<Documentacion />);
    await userEvent.click(await screen.findByRole("button", { name: /pedir documentación/i }));
    await userEvent.type(await screen.findByLabelText(/dni del titular/i), "34567890");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await userEvent.click(await screen.findByRole("button", { name: /^pedir documentación$/i }));

    expect(await screen.findByText(/hasta cuándo tiene tiempo/i)).toBeInTheDocument();
  });

  it("crea la solicitud con origen interno", async () => {
    renderizar(<Documentacion />);
    await userEvent.click(await screen.findByRole("button", { name: /pedir documentación/i }));
    await userEvent.type(await screen.findByLabelText(/dni del titular/i), "34567890");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await userEvent.type(await screen.findByLabelText("Plazo"), "2099-12-31");
    await userEvent.click(screen.getByRole("button", { name: /^pedir documentación$/i }));

    await waitFor(() =>
      expect(crearSolicitud).toHaveBeenCalledWith({
        titularId: 3,
        tipoDocumento: "DNI",
        plazo: "2099-12-31",
        origen: "INTERNA",
      }),
    );
  });

  it("avisa si el titular no existe", async () => {
    buscarPorDni.mockResolvedValue({ existe: false });
    renderizar(<Documentacion />);
    await userEvent.click(await screen.findByRole("button", { name: /pedir documentación/i }));
    await userEvent.type(await screen.findByLabelText(/dni del titular/i), "99999999");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(/no hay ningún vecino con ese dni/i)).toBeInTheDocument();
  });

  it("muestra el error del backend si el alta falla", async () => {
    crearSolicitud.mockRejectedValue(new ErrorApi({ status: 404, message: "No existe el titular" }));
    renderizar(<Documentacion />);
    await userEvent.click(await screen.findByRole("button", { name: /pedir documentación/i }));
    await userEvent.type(await screen.findByLabelText(/dni del titular/i), "34567890");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await userEvent.type(await screen.findByLabelText("Plazo"), "2099-12-31");
    await userEvent.click(screen.getByRole("button", { name: /^pedir documentación$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no existe el titular/i);
  });
});

describe("acciones según el rol", () => {
  it("el auditor ve las solicitudes pero no puede pedir ni cambiar estados", async () => {
    conSesion({ rol: "AUDITOR", subType: "EMPLEADO" });
    renderizar(<Documentacion />);
    await screen.findByText("Certificado de domicilio");

    expect(screen.queryByRole("button", { name: /pedir documentación/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Estado" })).not.toBeInTheDocument();
  });
});
