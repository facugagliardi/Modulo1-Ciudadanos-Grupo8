import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Familia } from "./Familia";
import { conSesion, elegirOpcion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const listarRelaciones = vi.fn();
const crearRelacion = vi.fn();
const actualizarRelacion = vi.fn();
const cambiarResponsable = vi.fn();
const eliminarRelacion = vi.fn();
const buscarPorDni = vi.fn();

vi.mock("@/lib/api/endpoints/relaciones", () => ({
  listarRelaciones: (...a) => listarRelaciones(...a),
  crearRelacion: (...a) => crearRelacion(...a),
  actualizarRelacion: (...a) => actualizarRelacion(...a),
  cambiarResponsable: (...a) => cambiarResponsable(...a),
  eliminarRelacion: (...a) => eliminarRelacion(...a),
}));
vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  buscarPorDni: (...a) => buscarPorDni(...a),
}));

const VINCULO = {
  relacionId: 1, ciudadanoRelacionadoId: 2, nombre: "Ana", apellido: "Pérez",
  tipoRelacion: "HIJA", esResponsable: false,
};

beforeEach(() => {
  [listarRelaciones, crearRelacion, actualizarRelacion, cambiarResponsable, eliminarRelacion, buscarPorDni]
    .forEach((m) => m.mockReset());
  listarRelaciones.mockResolvedValue([VINCULO]);
  crearRelacion.mockResolvedValue({});
  actualizarRelacion.mockResolvedValue({});
  cambiarResponsable.mockResolvedValue({});
  eliminarRelacion.mockResolvedValue(null);
  buscarPorDni.mockResolvedValue({ existe: true, id: 2, nombre: "Ana", apellido: "Pérez", estado: "ACTIVO" });
  conSesion({ id: 1, rol: "PERSONA", subType: "CIUDADANO" });
});

describe("listado", () => {
  it("muestra el vínculo traducido al castellano", async () => {
    renderizar(<Familia />);
    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Hija")).toBeInTheDocument();
  });

  it("permite marcar quién es responsable", async () => {
    renderizar(<Familia />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /es responsable/i }));
    await waitFor(() => expect(cambiarResponsable).toHaveBeenCalledWith(1, true));
  });

  it("explica para qué sirve cuando no hay vínculos", async () => {
    listarRelaciones.mockResolvedValue([]);
    renderizar(<Familia />);
    expect(await screen.findByText(/no tenés vínculos cargados/i)).toBeInTheDocument();
    expect(screen.getByText(/programas sociales/i)).toBeInTheDocument();
  });
});

describe("alta: buscar a la otra persona", () => {
  it("valida el DNI antes de consultar", async () => {
    renderizar(<Familia />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar vínculo/i }));
    await userEvent.type(await screen.findByLabelText(/dni de la persona/i), "123");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(/entre 7 y 9 dígitos/i)).toBeInTheDocument();
    expect(buscarPorDni).not.toHaveBeenCalled();
  });

  it("avisa si la persona no está registrada", async () => {
    // El endpoint nunca da 404: responde {existe:false}.
    buscarPorDni.mockResolvedValue({ existe: false });
    renderizar(<Familia />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar vínculo/i }));
    await userEvent.type(await screen.findByLabelText(/dni de la persona/i), "99999999");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(/tiene que registrarse primero/i)).toBeInTheDocument();
  });

  it("no deja vincularse con uno mismo", async () => {
    buscarPorDni.mockResolvedValue({ existe: true, id: 1, nombre: "Diego", apellido: "Lopez" });
    renderizar(<Familia />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar vínculo/i }));
    await userEvent.type(await screen.findByLabelText(/dni de la persona/i), "34567890");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(/ese sos vos/i)).toBeInTheDocument();
  });
});

describe("alta: los dos extremos del vínculo", () => {
  async function llegarAlPaso2() {
    renderizar(<Familia />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar vínculo/i }));
    await userEvent.type(await screen.findByLabelText(/dni de la persona/i), "40123456");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByLabelText(/¿qué es ana pérez tuyo\?/i);
  }

  it("NO adivina el recíproco cuando depende del género", async () => {
    // Una hija puede tener padre o madre. Suponerlo escribiría un dato falso,
    // así que el campo queda vacío y se pregunta.
    await llegarAlPaso2();
    await elegirOpcion(screen.getByLabelText(/¿qué es ana pérez tuyo\?/i), "HIJA");
    // `toHaveValue` no sirve: el desplegable dejó de ser un <select> y su
    // disparador es un botón. El valor elegido se lee en `data-valor`.
    expect(screen.getByLabelText(/¿y vos qué sos/i)).toHaveAttribute("data-valor", "");
    expect(screen.getByText(/no lo podemos deducir/i)).toBeInTheDocument();
  });

  it("no deja guardar sin elegir el otro extremo", async () => {
    await llegarAlPaso2();
    await elegirOpcion(screen.getByLabelText(/¿qué es ana pérez tuyo\?/i), "HIJA");
    await userEvent.click(screen.getByRole("button", { name: /^agregar vínculo$/i }));

    expect(await screen.findByText(/elegí qué sos vos/i)).toBeInTheDocument();
    expect(crearRelacion).not.toHaveBeenCalled();
  });

  it("sí propone el recíproco cuando el vínculo lo determina", async () => {
    await llegarAlPaso2();
    await elegirOpcion(screen.getByLabelText(/¿qué es ana pérez tuyo\?/i), "CONYUGE");
    expect(screen.getByLabelText(/¿y vos qué sos/i)).toHaveAttribute("data-valor", "CONYUGE");
  });

  it("crea el vínculo declarando los dos extremos", async () => {
    await llegarAlPaso2();
    await elegirOpcion(screen.getByLabelText(/¿qué es ana pérez tuyo\?/i), "HIJA");
    await elegirOpcion(screen.getByLabelText(/¿y vos qué sos/i), "PADRE");
    await userEvent.click(screen.getByRole("button", { name: /^agregar vínculo$/i }));

    await waitFor(() =>
      expect(crearRelacion).toHaveBeenCalledWith({
        ciudadanoId1: 1,
        ciudadanoId2: 2,
        relacionCiudadano1: "PADRE",
        relacionCiudadano2: "HIJA",
        esResponsable: false,
      }),
    );
  });

  it("explica el 409 de vínculo duplicado", async () => {
    crearRelacion.mockRejectedValue(new ErrorApi({ status: 409, message: "duplicate" }));
    await llegarAlPaso2();
    await elegirOpcion(screen.getByLabelText(/¿y vos qué sos/i), "PADRE");
    await userEvent.click(screen.getByRole("button", { name: /^agregar vínculo$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya existe un vínculo/i);
  });
});

describe("eliminación", () => {
  it("aclara que sólo se borra el vínculo, no la persona", async () => {
    renderizar(<Familia />);
    await userEvent.click(await screen.findByRole("button", { name: /eliminar vínculo/i }));

    expect(await screen.findByText(/los datos de esa persona no se tocan/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^eliminar vínculo$/i }));
    await waitFor(() => expect(eliminarRelacion).toHaveBeenCalledWith(1));
  });
});
