import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const verificarDni = vi.fn();
vi.mock("@/lib/api/endpoints/auth", () => ({
  registrarYEntrar: (...a) => registrarYEntrar(...a),
  verificarDni: (...a) => verificarDni(...a),
}));

// jsdom no tiene canvas: la compresión se prueba en el navegador.
const unida = new File(["fd"], "dni-frente-y-dorso.jpg", { type: "image/jpeg" });
const unirFrenteYDorso = vi.fn();
vi.mock("@/lib/dominio/imagen", () => ({
  comprimirImagen: async (archivo) => archivo,
  unirFrenteYDorso: (...a) => unirFrenteYDorso(...a),
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
  verificarDni.mockReset();
  unirFrenteYDorso.mockReset();
  unirFrenteYDorso.mockResolvedValue(unida);
});

afterEach(() => vi.unstubAllEnvs());

async function completarCiudadano({ nacionalidad = "Uruguaya" } = {}) {
  await userEvent.type(screen.getByLabelText("Nombre"), "Ana");
  await userEvent.type(screen.getByLabelText("Apellido"), "Pérez");
  await userEvent.type(screen.getByLabelText("DNI"), "40123456");
  await escribirFecha(screen.getByLabelText(/fecha de nacimiento/i), "1997-03-08");
  await userEvent.clear(screen.getByLabelText("Nacionalidad"));
  await userEvent.type(screen.getByLabelText("Nacionalidad"), nacionalidad);
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
    await userEvent.click(screen.getByRole("button", { name: /^continuar a/i }));

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

describe("flujo de onboarding sin verificación por IA", () => {
  it.each([
    { nacionalidad: "Uruguaya", ia: "true" },
    { nacionalidad: "Argentina", ia: "false" },
  ])("completa los 3 pasos con nacionalidad $nacionalidad e IA=$ia", async ({ nacionalidad, ia }) => {
    vi.stubEnv("VITE_VERIFICACION_DNI_IA", ia);
    renderizar(<Registro />);
    await completarCiudadano({ nacionalidad });
    await userEvent.click(screen.getByRole("button", { name: /continuar a documentación/i }));

    expect(registrarYEntrar).toHaveBeenCalledWith(
      expect.objectContaining({ dni: "40123456", nombre: "Ana", nacionalidad }),
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
    expect(verificarDni).not.toHaveBeenCalled();
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

describe("registro con DNI argentino: verificación antes de crear la cuenta", () => {
  const frente = new File(["f"], "frente.jpg", { type: "image/jpeg" });
  const dorso = new File(["d"], "dorso.jpg", { type: "image/jpeg" });

  const campo = (campo, coincide, leido) => ({
    campo,
    etiqueta: campo,
    ingresado: "x",
    leido,
    coincide,
    detalle: null,
  });

  async function llegarAVerificar() {
    renderizar(<Registro />);
    await completarCiudadano({ nacionalidad: "Argentina" });
    await userEvent.click(screen.getByRole("button", { name: /continuar a verificar dni/i }));
    expect(await screen.findByText(/verificá tu dni/i)).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText(/foto del frente/i), frente);
    await userEvent.upload(screen.getByLabelText(/foto del dorso/i), dorso);
  }

  it("no crea la cuenta en el paso 1", async () => {
    await llegarAVerificar();
    expect(registrarYEntrar).not.toHaveBeenCalled();
  });

  it("si coincide, crea la cuenta, guarda frente y dorso y pasa al contacto", async () => {
    verificarDni.mockResolvedValue({
      coincide: true,
      problemas: [],
      campos: [campo("apellido", true, "PÉREZ"), campo("dni", true, "40123456")],
    });
    await llegarAVerificar();
    await userEvent.click(screen.getByRole("button", { name: /^verificar dni$/i }));

    // Una sola imagen a Groq: frente arriba, dorso abajo (en ese orden).
    expect(unirFrenteYDorso).toHaveBeenCalledWith(frente, dorso);
    expect(verificarDni).toHaveBeenCalledWith(
      expect.objectContaining({ imagen: unida, dni: "40123456", cuit: "20-40123456-7" }),
    );
    expect(await screen.findByText(/tus datos coinciden con el dni/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /crear mi cuenta/i }));
    expect(registrarYEntrar).toHaveBeenCalledTimes(1);
    expect(subirDocumento).toHaveBeenCalledWith(1, { archivo: frente, tipoDocumento: "DNI" });
    expect(subirDocumento).toHaveBeenCalledWith(1, { archivo: dorso, tipoDocumento: "DNI" });
    expect(await screen.findByText(/datos de contacto/i)).toBeInTheDocument();
  });

  it("si no coincide, muestra qué dice el DNI y no deja crear la cuenta", async () => {
    verificarDni.mockResolvedValue({
      coincide: false,
      problemas: ["El DNI esta vencido desde el 2020-01-01."],
      campos: [campo("apellido", false, "PEREZ GOMEZ")],
    });
    await llegarAVerificar();
    await userEvent.click(screen.getByRole("button", { name: /^verificar dni$/i }));

    expect(await screen.findByText(/los datos no coinciden/i)).toBeInTheDocument();
    expect(screen.getByText("PEREZ GOMEZ")).toBeInTheDocument();
    expect(screen.getByText(/vencido/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crear mi cuenta/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /corregir mis datos/i }));
    expect(screen.getByLabelText("Apellido")).toHaveValue("Pérez");
    expect(registrarYEntrar).not.toHaveBeenCalled();
  });

  it("explica el 409 volviendo al paso 1 después de verificar", async () => {
    verificarDni.mockResolvedValue({ coincide: true, problemas: [], campos: [] });
    registrarYEntrar.mockRejectedValue(new ErrorApi({ status: 409, message: "El cuit ya existe" }));
    await llegarAVerificar();
    await userEvent.click(screen.getByRole("button", { name: /^verificar dni$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /crear mi cuenta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya hay una cuenta registrada/i);
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });
});
