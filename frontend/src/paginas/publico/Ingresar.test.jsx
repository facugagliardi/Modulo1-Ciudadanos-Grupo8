import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Ingresar } from "./Ingresar";
import { renderizar, sinSesion } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const navegar = vi.fn();
vi.mock("react-router-dom", async () => {
  const real = await vi.importActual("react-router-dom");
  return { ...real, useNavigate: () => navegar };
});

const ingresar = vi.fn();
const ingresarEmpleado = vi.fn();
vi.mock("@/lib/api/endpoints/auth", () => ({
  ingresar: (...a) => ingresar(...a),
  ingresarEmpleado: (...a) => ingresarEmpleado(...a),
}));

beforeEach(() => {
  sinSesion();
  navegar.mockClear();
  ingresar.mockReset();
  ingresarEmpleado.mockReset();
});

describe("validación", () => {
  it("pide el CUIT antes de llamar al backend", async () => {
    renderizar(<Ingresar />);
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByText(/ingresá tu cuit o cuil/i)).toBeInTheDocument();
    expect(ingresar).not.toHaveBeenCalled();
  });

  it("avisa si el CUIT no tiene 11 dígitos", async () => {
    renderizar(<Ingresar />);
    await userEvent.type(screen.getByLabelText(/cuit o cuil/i), "123");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "clave-larga");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByText(/11 dígitos/i)).toBeInTheDocument();
    expect(ingresar).not.toHaveBeenCalled();
  });

  it("el error se borra al corregir el campo", async () => {
    renderizar(<Ingresar />);
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText(/ingresá tu cuit/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/cuit o cuil/i), "2");
    expect(screen.queryByText(/ingresá tu cuit/i)).not.toBeInTheDocument();
  });

  it("marca el campo con aria-invalid para los lectores de pantalla", async () => {
    renderizar(<Ingresar />);
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByLabelText(/cuit o cuil/i)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("ingreso de vecino", () => {
  it("manda el CUIT y entra al portal", async () => {
    ingresar.mockResolvedValue({ subType: "CIUDADANO", rol: "PERSONA" });
    renderizar(<Ingresar />);

    await userEvent.type(screen.getByLabelText(/cuit o cuil/i), "20-34567890-1");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "Ciudadano.2026");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(ingresar).toHaveBeenCalledWith({
      cuit: "20-34567890-1",
      password: "Ciudadano.2026",
    });
    expect(navegar).toHaveBeenCalledWith("/portal", { replace: true });
  });

  it("muestra el error del backend sin inventar nada", async () => {
    ingresar.mockRejectedValue(new ErrorApi({ status: 401, message: "Credenciales inválidas" }));
    renderizar(<Ingresar />);

    await userEvent.type(screen.getByLabelText(/cuit o cuil/i), "20345678901");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "mal");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/sesión venció|credenciales/i);
  });
});

describe("ingreso de empleado", () => {
  it("cambia los campos al elegir empleado", async () => {
    renderizar(<Ingresar />);
    await userEvent.click(screen.getByRole("radio", { name: /soy empleado/i }));

    expect(screen.getByLabelText(/correo institucional/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/cuit o cuil/i)).not.toBeInTheDocument();
  });

  it("usa el endpoint de empleados y entra al backoffice", async () => {
    ingresarEmpleado.mockResolvedValue({ subType: "EMPLEADO", rol: "RESPONSABLE_AREA" });
    renderizar(<Ingresar />);

    await userEvent.click(screen.getByRole("radio", { name: /soy empleado/i }));
    await userEvent.type(screen.getByLabelText(/correo/i), "admin@municipio.gob.ar");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "Empleado.2026");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(ingresarEmpleado).toHaveBeenCalledWith({
      mail: "admin@municipio.gob.ar",
      password: "Empleado.2026",
    });
    expect(navegar).toHaveBeenCalledWith("/admin", { replace: true });
  });

  it("valida el formato del correo", async () => {
    renderizar(<Ingresar />);
    await userEvent.click(screen.getByRole("radio", { name: /soy empleado/i }));
    await userEvent.type(screen.getByLabelText(/correo/i), "no-es-un-mail");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "clave");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByText(/revisá el correo/i)).toBeInTheDocument();
    expect(ingresarEmpleado).not.toHaveBeenCalled();
  });
});

describe("destino después del ingreso", () => {
  it("vuelve a la página que el usuario quería ver", async () => {
    ingresar.mockResolvedValue({ subType: "CIUDADANO" });
    renderizar(<Ingresar />, { ruta: "/ingresar" });

    // El estado de la ubicación lo pone RutaProtegida; acá se simula el caso
    // sin destino, que manda a la casa del rol.
    await userEvent.type(screen.getByLabelText(/cuit o cuil/i), "20345678901");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "x1");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(navegar).toHaveBeenCalledWith("/portal", { replace: true });
  });
});
