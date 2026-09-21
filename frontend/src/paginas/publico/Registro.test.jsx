import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Registro } from "./Registro";
import { escribirFecha, renderizar, sinSesion } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const navegar = vi.fn();
vi.mock("react-router-dom", async () => {
  const real = await vi.importActual("react-router-dom");
  return { ...real, useNavigate: () => navegar };
});

const registrarYEntrar = vi.fn();
vi.mock("@/lib/api/endpoints/auth", () => ({
  registrarYEntrar: (...a) => registrarYEntrar(...a),
}));

beforeEach(() => {
  sinSesion();
  navegar.mockClear();
  registrarYEntrar.mockReset();
  registrarYEntrar.mockResolvedValue({ persona: {}, sesion: { subType: "CIUDADANO" } });
});

async function completarPersona() {
  await userEvent.type(screen.getByLabelText("Nombre"), "Ana");
  await userEvent.type(screen.getByLabelText("Apellido"), "Pérez");
  await userEvent.type(screen.getByLabelText("DNI"), "40123456");
  await escribirFecha(screen.getByLabelText(/fecha de nacimiento/i), "1997-03-08");
  await userEvent.type(screen.getByLabelText("CUIL"), "20-40123456-7");
  await userEvent.type(screen.getByLabelText("Contraseña"), "clave-segura-1");
}

describe("elección del tipo de persona", () => {
  it("arranca en persona física", () => {
    renderizar(<Registro />);
    expect(screen.getByLabelText("DNI")).toBeInTheDocument();
    expect(screen.queryByLabelText(/razón social/i)).not.toBeInTheDocument();
  });

  it("al elegir organización cambia el bloque de campos", async () => {
    // El backend tiene un solo endpoint donde `tipo` decide qué se exige;
    // mostrar los once campos juntos obligaría a descartar la mitad.
    renderizar(<Registro />);
    await userEvent.click(screen.getByRole("radio", { name: /una organización/i }));

    expect(screen.getByLabelText(/razón social/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre de fantasía/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("DNI")).not.toBeInTheDocument();
    expect(screen.getByLabelText("CUIT")).toBeInTheDocument();
  });
});

describe("validación", () => {
  it("no llama al backend con el formulario vacío", async () => {
    renderizar(<Registro />);
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/ingresá tu nombre/i)).toBeInTheDocument();
    expect(screen.getByText(/ingresá tu dni/i)).toBeInTheDocument();
    expect(registrarYEntrar).not.toHaveBeenCalled();
  });

  it("exige una contraseña de al menos 8 caracteres, como el backend", async () => {
    renderizar(<Registro />);
    await completarPersona();
    await userEvent.clear(screen.getByLabelText("Contraseña"));
    await userEvent.type(screen.getByLabelText("Contraseña"), "corta");
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(registrarYEntrar).not.toHaveBeenCalled();
  });

  it("rechaza una fecha de nacimiento futura", async () => {
    renderizar(<Registro />);
    await completarPersona();
    await userEvent.clear(screen.getByLabelText(/fecha de nacimiento/i));
    await escribirFecha(screen.getByLabelText(/fecha de nacimiento/i), "2099-01-01");
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/anterior a hoy/i)).toBeInTheDocument();
  });

  it("valida el largo del DNI", async () => {
    renderizar(<Registro />);
    await completarPersona();
    await userEvent.clear(screen.getByLabelText("DNI"));
    await userEvent.type(screen.getByLabelText("DNI"), "123");
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/entre 7 y 9 dígitos/i)).toBeInTheDocument();
  });

  it("la organización exige razón social y nombre de fantasía", async () => {
    renderizar(<Registro />);
    await userEvent.click(screen.getByRole("radio", { name: /una organización/i }));
    await userEvent.type(screen.getByLabelText("CUIT"), "30712345678");
    await userEvent.type(screen.getByLabelText("Contraseña"), "clave-segura-1");
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/ingresá la razón social/i)).toBeInTheDocument();
    expect(screen.getByText(/ingresá el nombre de fantasía/i)).toBeInTheDocument();
  });
});

describe("alta", () => {
  it("registra y entra sin pedir un segundo login", async () => {
    renderizar(<Registro />);
    await completarPersona();
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(registrarYEntrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "CIUDADANO", dni: "40123456", nombre: "Ana" }),
    );
    expect(navegar).toHaveBeenCalledWith("/portal", { replace: true });
  });

  it("explica el 409 en lugar de mostrar el mensaje técnico", async () => {
    registrarYEntrar.mockRejectedValue(
      new ErrorApi({ status: 409, message: "El cuit ya existe" }),
    );
    renderizar(<Registro />);
    await completarPersona();
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya hay una cuenta registrada/i);
  });

  it("pinta el detalle campo por campo que devuelve el backend", async () => {
    registrarYEntrar.mockRejectedValue(
      new ErrorApi({
        status: 400,
        message: "Error de validación",
        errores: { nombre: "nombre es obligatorio" },
      }),
    );
    renderizar(<Registro />);
    await completarPersona();
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText("nombre es obligatorio")).toBeInTheDocument();
  });

  it("avisa que el domicilio se carga después", () => {
    // El backend no lo acepta en el alta; decirlo evita que la persona lo busque.
    renderizar(<Registro />);
    expect(screen.getByText(/el domicilio se carga después/i)).toBeInTheDocument();
  });
});
