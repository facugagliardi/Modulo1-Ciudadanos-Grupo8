import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AltaDeVecino, generarClave } from "./AltaDeVecino";
import { conSesion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const registrarPersona = vi.fn();
const buscarPorDni = vi.fn();

vi.mock("@/lib/api/endpoints/auth", () => ({
  registrarPersona: (...a) => registrarPersona(...a),
}));
vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  buscarPorDni: (...a) => buscarPorDni(...a),
}));

const CREADO = {
  personaId: 9, tipo: "CIUDADANO", dni: "40123456", nombre: "Ana", apellido: "Pérez",
  fechaNacimiento: "1997-03-08", cuil: "27401234564", estado: "ACTIVO",
};

async function completar() {
  await userEvent.type(screen.getByLabelText("Nombre"), "Ana");
  await userEvent.type(screen.getByLabelText("Apellido"), "Pérez");
  await userEvent.type(screen.getByLabelText(/fecha de nacimiento/i), "1997-03-08");
  await userEvent.type(screen.getByLabelText("CUIL"), "27401234564");
}

beforeEach(() => {
  registrarPersona.mockReset();
  buscarPorDni.mockReset();
  registrarPersona.mockResolvedValue(CREADO);
  buscarPorDni.mockResolvedValue({ existe: false });
  conSesion({ id: 1, rol: "MESA_ENTRADAS", subType: "EMPLEADO" });
});

describe("chequeo del DNI en vivo", () => {
  it("no consulta hasta que el DNI tiene largo válido", async () => {
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "123");
    await new Promise((r) => setTimeout(r, 600));
    expect(buscarPorDni).not.toHaveBeenCalled();
  });

  it("confirma cuando el DNI está libre", async () => {
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "40123456");
    expect(await screen.findByText(/no está registrado/i)).toBeInTheDocument();
  });

  it("avisa del duplicado antes de mandar nada, y ofrece el legajo", async () => {
    // Un duplicado en el padrón es peor que un error de formulario: el DNI es
    // único y el alta terminaría en 409 igual.
    buscarPorDni.mockResolvedValue({
      existe: true, id: 3, nombre: "Diego", apellido: "Lopez", estado: "ACTIVO",
    });
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "34567890");

    expect(await screen.findByText(/ya está en el padrón/i)).toBeInTheDocument();
    expect(screen.getByText("Diego Lopez")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir su legajo/i })).toHaveAttribute(
      "href",
      "/admin/padron/3",
    );
  });

  it("con un DNI duplicado no deja registrar", async () => {
    buscarPorDni.mockResolvedValue({ existe: true, id: 3, nombre: "Diego", apellido: "Lopez", estado: "ACTIVO" });
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "34567890");
    await screen.findByText(/ya está en el padrón/i);

    expect(screen.getByRole("button", { name: /registrar vecino/i })).toBeDisabled();
    expect(screen.getByText(/en el padrón es único/i)).toBeInTheDocument();
  });
});

describe("alta", () => {
  it("valida antes de llamar al backend", async () => {
    renderizar(<AltaDeVecino />);
    await userEvent.click(screen.getByRole("button", { name: /registrar vecino/i }));

    expect(await screen.findByText(/ingresá el dni/i)).toBeInTheDocument();
    expect(screen.getByText(/ingresá el nombre/i)).toBeInTheDocument();
    expect(registrarPersona).not.toHaveBeenCalled();
  });

  it("registra sin sacar al empleado de su sesión", async () => {
    // Encadenar el login como hace el registro público dejaría al empleado
    // dentro de la cuenta del vecino.
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "40123456");
    await completar();
    await userEvent.click(screen.getByRole("button", { name: /registrar vecino/i }));

    await waitFor(() => expect(registrarPersona).toHaveBeenCalled());
    expect(registrarPersona.mock.calls[0][0]).toMatchObject({
      tipo: "CIUDADANO",
      dni: "40123456",
      nombre: "Ana",
      apellido: "Pérez",
      cuit: "27401234564",
    });
  });

  it("muestra las credenciales una sola vez y dice que hay que entregarlas", async () => {
    // El backend exige contraseña en el alta y no hay forma de enviársela: el
    // envío de notificaciones es del M9 y los eventos no se publican.
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "40123456");
    await completar();
    await userEvent.click(screen.getByRole("button", { name: /registrar vecino/i }));

    expect(await screen.findByText(/quedó en el padrón/i)).toBeInTheDocument();
    expect(screen.getByText(/entregale estos datos de acceso/i)).toBeInTheDocument();
    expect(screen.getByText(/no envía correos/i)).toBeInTheDocument();
    expect(screen.getByText("27401234564")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ir a su legajo/i })).toHaveAttribute(
      "href",
      "/admin/padron/9",
    );
  });

  it("deja encadenar otra alta con el formulario limpio", async () => {
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "40123456");
    await completar();
    await userEvent.click(screen.getByRole("button", { name: /registrar vecino/i }));
    await screen.findByText(/quedó en el padrón/i);

    await userEvent.click(screen.getByRole("button", { name: /registrar otro vecino/i }));
    expect(await screen.findByLabelText("DNI")).toHaveValue("");
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
  });

  it("explica el 409 sin el mensaje técnico", async () => {
    registrarPersona.mockRejectedValue(new ErrorApi({ status: 409, message: "duplicate key" }));
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "40123456");
    await completar();
    await userEvent.click(screen.getByRole("button", { name: /registrar vecino/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya hay una persona registrada/i);
  });

  it("rechaza una fecha de nacimiento futura", async () => {
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "40123456");
    await completar();
    await userEvent.clear(screen.getByLabelText(/fecha de nacimiento/i));
    await userEvent.type(screen.getByLabelText(/fecha de nacimiento/i), "2099-01-01");
    await userEvent.click(screen.getByRole("button", { name: /registrar vecino/i }));

    expect(await screen.findByText(/anterior a hoy/i)).toBeInTheDocument();
    expect(registrarPersona).not.toHaveBeenCalled();
  });
});

describe("la contraseña provisoria", () => {
  it("viene generada, no vacía", async () => {
    renderizar(<AltaDeVecino />);
    expect(screen.getByLabelText(/contraseña provisoria/i).value.length).toBeGreaterThanOrEqual(8);
  });

  it("se puede dictar sin confundir caracteres", () => {
    // Nada de l/1 ni O/0: alguien la va a leer en voz alta en un mostrador.
    for (let i = 0; i < 40; i += 1) {
      const clave = generarClave();
      expect(clave.length).toBeGreaterThanOrEqual(8);
      expect(clave).not.toMatch(/[lIO]/);
    }
  });

  it("el empleado puede escribir otra, pero no una corta", async () => {
    renderizar(<AltaDeVecino />);
    await userEvent.type(screen.getByLabelText("DNI"), "40123456");
    await completar();
    const clave = screen.getByLabelText(/contraseña provisoria/i);
    await userEvent.clear(clave);
    await userEvent.type(clave, "corta");
    await userEvent.click(screen.getByRole("button", { name: /registrar vecino/i }));

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(registrarPersona).not.toHaveBeenCalled();
  });
});
