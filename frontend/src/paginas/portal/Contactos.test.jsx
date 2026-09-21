import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Contactos } from "./Contactos";
import { conSesion, elegirOpcion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const listarContactos = vi.fn();
const crearContacto = vi.fn();
const actualizarContacto = vi.fn();
const eliminarContacto = vi.fn();
const verificarContacto = vi.fn();

vi.mock("@/lib/api/endpoints/contactos", () => ({
  listarContactos: (...a) => listarContactos(...a),
  crearContacto: (...a) => crearContacto(...a),
  actualizarContacto: (...a) => actualizarContacto(...a),
  eliminarContacto: (...a) => eliminarContacto(...a),
  verificarContacto: (...a) => verificarContacto(...a),
}));

const CORREO = { contactoId: 1, tipo: "EMAIL", valor: "diego@mail.com", verificado: true };
const TELEFONO = { contactoId: 2, tipo: "TELEFONO", valor: "+541144445555", verificado: false };

beforeEach(() => {
  [listarContactos, crearContacto, actualizarContacto, eliminarContacto, verificarContacto].forEach(
    (m) => m.mockReset(),
  );
  listarContactos.mockResolvedValue([CORREO, TELEFONO]);
  crearContacto.mockResolvedValue({});
  actualizarContacto.mockResolvedValue({});
  eliminarContacto.mockResolvedValue(null);
  verificarContacto.mockResolvedValue({});
  conSesion({ id: 1, rol: "PERSONA", subType: "CIUDADANO" });
});

describe("listado", () => {
  it("distingue el contacto verificado del que no lo está", async () => {
    renderizar(<Contactos />);
    expect(await screen.findByText("diego@mail.com")).toBeInTheDocument();
    expect(screen.getByText("Verificado")).toBeInTheDocument();
    expect(screen.getByText("Sin verificar")).toBeInTheDocument();
  });

  it("ofrece verificar sólo al que no lo está", async () => {
    renderizar(<Contactos />);
    await screen.findByText("diego@mail.com");
    // Un solo botón "Verificar": el del teléfono.
    expect(screen.getAllByRole("button", { name: "Verificar" })).toHaveLength(1);
  });

  it("insiste cuando no hay ningún contacto cargado", async () => {
    // Sin contacto, el municipio no puede avisar nada: no alcanza con una
    // lista vacía, hay que decir por qué importa.
    listarContactos.mockResolvedValue([]);
    renderizar(<Contactos />);
    expect(await screen.findByText(/todavía no cargaste ningún contacto/i)).toBeInTheDocument();
    expect(screen.getByText(/no podemos avisarte/i)).toBeInTheDocument();
  });
});

describe("alta", () => {
  it("valida el correo antes de llamar al backend", async () => {
    renderizar(<Contactos />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar contacto/i }));
    await userEvent.type(await screen.findByLabelText(/correo electrónico/i), "no-es-un-mail");
    await userEvent.click(screen.getByRole("button", { name: /^agregar contacto$/i }));

    expect(await screen.findByText(/revisá el correo/i)).toBeInTheDocument();
    expect(crearContacto).not.toHaveBeenCalled();
  });

  it("valida el teléfono con la misma regla que el backend", async () => {
    renderizar(<Contactos />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar contacto/i }));
    await elegirOpcion(await screen.findByLabelText("Tipo"), "TELEFONO");
    await userEvent.type(screen.getByLabelText(/teléfono/i), "123");
    await userEvent.click(screen.getByRole("button", { name: /^agregar contacto$/i }));

    expect(await screen.findByText(/entre 8 y 20 dígitos/i)).toBeInTheDocument();
    expect(crearContacto).not.toHaveBeenCalled();
  });

  it("manda sólo tipo y valor", async () => {
    renderizar(<Contactos />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar contacto/i }));
    await userEvent.type(await screen.findByLabelText(/correo electrónico/i), "nuevo@mail.com");
    await userEvent.click(screen.getByRole("button", { name: /^agregar contacto$/i }));

    await waitFor(() =>
      expect(crearContacto).toHaveBeenCalledWith(1, { tipo: "EMAIL", valor: "nuevo@mail.com" }),
    );
  });

  it("explica el 409 sin mostrar el mensaje técnico", async () => {
    crearContacto.mockRejectedValue(new ErrorApi({ status: 409, message: "duplicate key" }));
    renderizar(<Contactos />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar contacto/i }));
    await userEvent.type(await screen.findByLabelText(/correo electrónico/i), "diego@mail.com");
    await userEvent.click(screen.getByRole("button", { name: /^agregar contacto$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya tenés ese contacto/i);
  });
});

describe("verificación", () => {
  it("exige seis dígitos antes de llamar al backend", async () => {
    renderizar(<Contactos />);
    await userEvent.click(await screen.findByRole("button", { name: "Verificar" }));
    await userEvent.type(await screen.findByLabelText(/código/i), "123");
    await userEvent.click(screen.getAllByRole("button", { name: "Verificar" }).at(-1));

    expect(await screen.findByText(/tiene 6 dígitos/i)).toBeInTheDocument();
    expect(verificarContacto).not.toHaveBeenCalled();
  });

  it("avisa que el envío de códigos todavía no existe, en vez de simularlo", async () => {
    // El backend acepta cualquier código de seis dígitos porque no emite
    // ninguno. Decirlo es preferible a inventar un "te enviamos un código".
    renderizar(<Contactos />);
    await userEvent.click(await screen.findByRole("button", { name: "Verificar" }));
    expect(await screen.findByText(/envío de códigos todavía no está implementado/i)).toBeInTheDocument();
  });

  it("verifica con un código válido", async () => {
    renderizar(<Contactos />);
    await userEvent.click(await screen.findByRole("button", { name: "Verificar" }));
    await userEvent.type(await screen.findByLabelText(/código/i), "123456");
    await userEvent.click(screen.getAllByRole("button", { name: "Verificar" }).at(-1));

    await waitFor(() => expect(verificarContacto).toHaveBeenCalledWith(2, "123456"));
  });
});

describe("eliminación", () => {
  it("pide confirmación y avisa de la consecuencia", async () => {
    renderizar(<Contactos />);
    await userEvent.click(await screen.findByRole("button", { name: /eliminar diego@mail.com/i }));

    expect(await screen.findByText(/no va a poder avisarte/i)).toBeInTheDocument();
    expect(eliminarContacto).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));
    await waitFor(() => expect(eliminarContacto).toHaveBeenCalledWith(1));
  });
});
