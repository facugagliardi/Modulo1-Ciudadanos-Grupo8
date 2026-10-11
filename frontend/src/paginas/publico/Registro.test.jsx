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

const subirDocumento = vi.fn();
vi.mock("@/lib/api/endpoints/documentacion", () => ({
  subirDocumento: (...a) => subirDocumento(...a),
}));

const crearContacto = vi.fn();
vi.mock("@/lib/api/endpoints/contactos", () => ({
  crearContacto: (...a) => crearContacto(...a),
}));

beforeEach(() => {
  sinSesion();
  navegar.mockClear();
  registrarYEntrar.mockReset();
  registrarYEntrar.mockResolvedValue({ ciudadano: { id: 1 }, sesion: { id: 1, subType: "CIUDADANO" } });
  subirDocumento.mockReset();
  subirDocumento.mockResolvedValue({ documentoId: 10 });
  crearContacto.mockReset();
  crearContacto.mockResolvedValue({ contactoId: 20 });
});

async function completarCiudadano() {
  await userEvent.type(screen.getByLabelText("Nombre"), "Ana");
  await userEvent.type(screen.getByLabelText("Apellido"), "Pérez");
  await userEvent.type(screen.getByLabelText("DNI"), "40123456");
  await escribirFecha(screen.getByLabelText(/fecha de nacimiento/i), "1997-03-08");
  await userEvent.clear(screen.getByLabelText("Nacionalidad"));
  await userEvent.type(screen.getByLabelText("Nacionalidad"), "Argentina");
  await userEvent.type(screen.getByLabelText("CUIL"), "20-40123456-7");
  await userEvent.type(screen.getByLabelText("Contraseña"), "clave-segura-1");
}

describe("formulario de ciudadano", () => {
  it("muestra los campos de ciudadano físico incluyendo nacionalidad", () => {
    renderizar(<Registro />);
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Apellido")).toBeInTheDocument();
    expect(screen.getByLabelText("DNI")).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha de nacimiento/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Nacionalidad")).toBeInTheDocument();
    expect(screen.getByLabelText("CUIL")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.queryByLabelText(/razón social/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/nombre de fantasía/i)).not.toBeInTheDocument();
  });
});

describe("validación paso 1", () => {
  it("no llama al backend con el formulario vacío", async () => {
    renderizar(<Registro />);
    await userEvent.click(screen.getByRole("button", { name: /continuar a documentación/i }));

    expect(await screen.findByText(/ingresá tu nombre/i)).toBeInTheDocument();
    expect(screen.getByText(/ingresá tu dni/i)).toBeInTheDocument();
    expect(registrarYEntrar).not.toHaveBeenCalled();
  });

  it("exige una contraseña de al menos 8 caracteres, como el backend", async () => {
    renderizar(<Registro />);
    await completarCiudadano();
    await userEvent.clear(screen.getByLabelText("Contraseña"));
    await userEvent.type(screen.getByLabelText("Contraseña"), "corta");
    await userEvent.click(screen.getByRole("button", { name: /continuar a documentación/i }));

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(registrarYEntrar).not.toHaveBeenCalled();
  });

  it("rechaza una fecha de nacimiento futura", async () => {
    renderizar(<Registro />);
    await completarCiudadano();
    await userEvent.clear(screen.getByLabelText(/fecha de nacimiento/i));
    await escribirFecha(screen.getByLabelText(/fecha de nacimiento/i), "2099-01-01");
    await userEvent.click(screen.getByRole("button", { name: /continuar a documentación/i }));

    expect(await screen.findByText(/anterior a hoy/i)).toBeInTheDocument();
  });

  it("valida el largo del DNI", async () => {
    renderizar(<Registro />);
    await completarCiudadano();
    await userEvent.clear(screen.getByLabelText("DNI"));
    await userEvent.type(screen.getByLabelText("DNI"), "123");
    await userEvent.click(screen.getByRole("button", { name: /continuar a documentación/i }));

    expect(await screen.findByText(/entre 7 y 9 dígitos/i)).toBeInTheDocument();
  });
});

describe("flujo de onboarding completo (3 pasos)", () => {
  it("avanza por los 3 pasos obligatorios: registro, documento y contacto antes de entrar", async () => {
    renderizar(<Registro />);
    await completarCiudadano();
    await userEvent.click(screen.getByRole("button", { name: /continuar a documentación/i }));

    expect(registrarYEntrar).toHaveBeenCalledWith(
      expect.objectContaining({ dni: "40123456", nombre: "Ana", nacionalidad: "Argentina" }),
    );

    // Paso 2: Foto de DNI
    expect(await screen.findByText(/subí tu documento de identidad/i)).toBeInTheDocument();
    const inputArchivo = document.querySelector("#archivo-dni");
    expect(inputArchivo).toBeInTheDocument();

    const archivoPrueba = new File(["dummy content"], "dni_frente.jpg", { type: "image/jpeg" });
    await userEvent.upload(inputArchivo, archivoPrueba);

    await userEvent.click(screen.getByRole("button", { name: /enviar documento y continuar/i }));
    expect(subirDocumento).toHaveBeenCalledWith(1, {
      archivo: archivoPrueba,
      tipoDocumento: "DNI",
    });

    // Paso 3: Contacto (email)
    expect(await screen.findByText(/datos de contacto/i)).toBeInTheDocument();
    const campoEmail = screen.getByLabelText(/correo electrónico/i);
    await userEvent.type(campoEmail, "ana.perez@ejemplo.com");

    await userEvent.click(screen.getByRole("button", { name: /guardar correo y entrar al sistema/i }));
    expect(crearContacto).toHaveBeenCalledWith(1, {
      tipo: "EMAIL",
      valor: "ana.perez@ejemplo.com",
    });

    expect(navegar).toHaveBeenCalledWith("/portal", { replace: true });
  });

  it("explica el 409 en lugar de mostrar el mensaje técnico", async () => {
    registrarYEntrar.mockRejectedValue(
      new ErrorApi({ status: 409, message: "El cuit ya existe" }),
    );
    renderizar(<Registro />);
    await completarCiudadano();
    await userEvent.click(screen.getByRole("button", { name: /continuar a documentación/i }));

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
    await completarCiudadano();
    await userEvent.click(screen.getByRole("button", { name: /continuar a documentación/i }));

    expect(await screen.findByText("nombre es obligatorio")).toBeInTheDocument();
  });
});
