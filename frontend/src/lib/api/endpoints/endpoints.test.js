import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Los módulos de endpoints son finos a propósito, pero concentran dos cosas
 * fáciles de escribir mal y difíciles de notar: la ruta exacta y qué campos
 * viajan en el cuerpo. Estas pruebas fijan las dos.
 */

const cliente = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  pedir: vi.fn(),
  autenticar: vi.fn(),
};

vi.mock("../cliente", () => ({
  get: (...a) => cliente.get(...a),
  post: (...a) => cliente.post(...a),
  put: (...a) => cliente.put(...a),
  patch: (...a) => cliente.patch(...a),
  del: (...a) => cliente.del(...a),
  pedir: (...a) => cliente.pedir(...a),
  autenticar: (...a) => cliente.autenticar(...a),
}));

const cerrarSesion = vi.fn();
vi.mock("../../auth/almacen", () => ({ cerrarSesion: () => cerrarSesion() }));

const {
  listarCiudadanos,
  obtenerCiudadano,
  actualizarCiudadano,
  cambiarEstadoCiudadano,
  buscarPorDni,
} = await import("./ciudadanos");
const { ingresar, ingresarEmpleado, registrarYEntrar, salir } = await import("./auth");
const {
  listarDomicilios,
  crearDomicilio,
  actualizarDomicilio,
  marcarDomicilioPrincipal,
  cerrarDomicilio,
  listarDocumentos,
  listarRepresentaciones,
} = await import("./personas");
const { listarContactos, crearContacto, verificarContacto, eliminarContacto, actualizarContacto } =
  await import("./contactos");
const { listarRelaciones, crearRelacion, cambiarResponsable, eliminarRelacion, actualizarRelacion } =
  await import("./relaciones");
const {
  listarExpedientes,
  obtenerExpediente,
  crearExpediente,
  crearActuacion,
  listarActuaciones,
  cambiarEstadoExpediente,
} = await import("./expedientes");

beforeEach(() => {
  Object.values(cliente).forEach((m) => m.mockReset());
  cerrarSesion.mockReset();
  cliente.get.mockResolvedValue({ items: [] });
  cliente.post.mockResolvedValue({});
  cliente.put.mockResolvedValue({});
  cliente.patch.mockResolvedValue({});
  cliente.del.mockResolvedValue(null);
  cliente.pedir.mockResolvedValue(null);
  cliente.autenticar.mockResolvedValue({ subType: "CIUDADANO" });
});

describe("listados", () => {
  it("desenvuelven el {items:[…]} que usa todo el backend", async () => {
    cliente.get.mockResolvedValue({ items: [{ id: 1 }] });
    await expect(listarCiudadanos()).resolves.toEqual([{ id: 1 }]);
  });

  it("devuelven un array vacío si la respuesta no trae items", async () => {
    cliente.get.mockResolvedValue(null);
    await expect(listarCiudadanos()).resolves.toEqual([]);
    await expect(listarDomicilios(1)).resolves.toEqual([]);
    await expect(listarContactos(1)).resolves.toEqual([]);
    await expect(listarRelaciones(1)).resolves.toEqual([]);
    await expect(listarExpedientes()).resolves.toEqual([]);
    await expect(listarDocumentos(1)).resolves.toEqual([]);
    await expect(listarRepresentaciones(1)).resolves.toEqual([]);
    await expect(listarActuaciones(1)).resolves.toEqual([]);
  });
});

describe("rutas", () => {
  it("arma las rutas de ciudadanos", async () => {
    await obtenerCiudadano(3);
    expect(cliente.get).toHaveBeenCalledWith("/ciudadanos/3", undefined);

    await buscarPorDni("34567890");
    expect(cliente.get).toHaveBeenCalledWith("/ciudadanos/dni/34567890", undefined);
  });

  it("las rutas de domicilios cuelgan de /personas, así sirven para una jurídica", async () => {
    await listarDomicilios(7);
    expect(cliente.get).toHaveBeenCalledWith("/personas/7/domicilios", undefined);

    await marcarDomicilioPrincipal(12);
    // Sin cuerpo: mandar campos da 400.
    expect(cliente.patch).toHaveBeenCalledWith("/domicilios/12/principal");

    await cerrarDomicilio(12);
    expect(cliente.del).toHaveBeenCalledWith("/domicilios/12");
  });

  it("arma las rutas de contactos y relaciones", async () => {
    await listarContactos(3);
    expect(cliente.get).toHaveBeenCalledWith("/ciudadanos/3/contactos", undefined);
    await eliminarContacto(9);
    expect(cliente.del).toHaveBeenCalledWith("/contactos/9");
    await listarRelaciones(3);
    expect(cliente.get).toHaveBeenCalledWith("/ciudadanos/3/relaciones", undefined);
    await eliminarRelacion(4);
    expect(cliente.del).toHaveBeenCalledWith("/relaciones/4");
  });

  it("arma las rutas de expedientes y actuaciones", async () => {
    await obtenerExpediente(5);
    expect(cliente.get).toHaveBeenCalledWith("/expedientes/5", undefined);
    await listarActuaciones(5);
    expect(cliente.get).toHaveBeenCalledWith("/expedientes/5/actuaciones", undefined);
  });
});

describe("cuerpos filtrados", () => {
  it("actualizarCiudadano descarta lo que el DTO no acepta", async () => {
    await actualizarCiudadano(3, {
      nombre: "Ana",
      estado: "BLOQUEADO", // no está en el DTO: iría a 400
      id: 3,
    });
    expect(cliente.put).toHaveBeenCalledWith("/ciudadanos/3", { nombre: "Ana" });
  });

  it("actualizarDomicilio no manda esPrincipal", async () => {
    await actualizarDomicilio(12, { tipo: "CASA", calle: "Rivadavia", numero: "100", esPrincipal: true });
    expect(cliente.put).toHaveBeenCalledWith("/domicilios/12", {
      tipo: "CASA",
      calle: "Rivadavia",
      numero: "100",
    });
  });

  it("crearDomicilio sí lo manda", async () => {
    await crearDomicilio(7, { tipo: "CASA", calle: "R", numero: "1", esPrincipal: true });
    expect(cliente.post.mock.calls[0][1]).toHaveProperty("esPrincipal", true);
  });

  it("los cambios de estado mandan sólo {estado}", async () => {
    await cambiarEstadoCiudadano(3, "INACTIVO");
    expect(cliente.patch).toHaveBeenCalledWith("/ciudadanos/3/estado", { estado: "INACTIVO" });

    await cambiarEstadoExpediente(5, "EN_TRAMITE");
    expect(cliente.patch).toHaveBeenCalledWith("/expedientes/5/estado", { estado: "EN_TRAMITE" });
  });

  it("verificarContacto manda sólo el código", async () => {
    await verificarContacto(9, "123456");
    expect(cliente.patch).toHaveBeenCalledWith("/contactos/9/verificar", { codigo: "123456" });
  });

  it("actualizarContacto manda tipo y valor", async () => {
    await actualizarContacto(9, { tipo: "EMAIL", valor: "a@b.com", verificado: true });
    expect(cliente.put).toHaveBeenCalledWith("/contactos/9", { tipo: "EMAIL", valor: "a@b.com" });
  });

  it("las relaciones se declaran desde los dos extremos", async () => {
    await crearRelacion({
      ciudadanoId1: 1,
      ciudadanoId2: 2,
      relacionCiudadano1: "PADRE",
      relacionCiudadano2: "HIJO",
      esResponsable: true,
      basura: "x",
    });
    expect(cliente.post).toHaveBeenCalledWith("/relaciones", {
      ciudadanoId1: 1,
      ciudadanoId2: 2,
      relacionCiudadano1: "PADRE",
      relacionCiudadano2: "HIJO",
      esResponsable: true,
    });

    await cambiarResponsable(4, false);
    expect(cliente.patch).toHaveBeenCalledWith("/relaciones/4/responsable", {
      esResponsable: false,
    });

    await actualizarRelacion(4, { relacionCiudadano1: "TUTOR", relacionCiudadano2: "TUTELADO" });
    expect(cliente.put).toHaveBeenCalledWith("/relaciones/4", {
      relacionCiudadano1: "TUTOR",
      relacionCiudadano2: "TUTELADO",
    });
  });

  it("crearExpediente puede omitir el número para que lo genere el backend", async () => {
    await crearExpediente({ personaId: 3, caratula: "Habilitación", areaIniciadora: "Mesa" });
    expect(cliente.post).toHaveBeenCalledWith("/expedientes", {
      personaId: 3,
      caratula: "Habilitación",
      areaIniciadora: "Mesa",
    });
  });

  it("crearActuacion acepta adjuntos", async () => {
    await crearActuacion(5, {
      tipo: "PASE",
      descripcion: "Pase a Obras",
      moduloOrigen: "M1",
      adjuntos: ["url"],
    });
    expect(cliente.post.mock.calls[0][1].adjuntos).toEqual(["url"]);
  });
});

describe("autenticación", () => {
  it("normaliza el CUIT antes de mandarlo", async () => {
    await ingresar({ cuit: "20-34567890-1", password: "x" });
    expect(cliente.autenticar).toHaveBeenCalledWith("/auth/login", {
      cuit: "20345678901",
      password: "x",
    });
  });

  it("el empleado entra por su propio endpoint, con mail", async () => {
    await ingresarEmpleado({ mail: "admin@municipio.gob.ar", password: "x" });
    expect(cliente.autenticar).toHaveBeenCalledWith("/auth/empleados/login", {
      mail: "admin@municipio.gob.ar",
      password: "x",
    });
  });

  it("el alta encadena el login, porque register no devuelve tokens", async () => {
    await registrarYEntrar({
      tipo: "CIUDADANO",
      cuit: "20-34567890-1",
      password: "clave-larga",
      dni: "34567890",
      nombre: "Ana",
      apellido: "Pérez",
      fechaNacimiento: "1997-03-08",
      razonSocial: "no corresponde",
    });

    const [ruta, cuerpo] = cliente.post.mock.calls[0];
    expect(ruta).toBe("/auth/register");
    expect(cuerpo.cuit).toBe("20345678901");
    // El bloque de jurídica no viaja cuando el tipo es CIUDADANO.
    expect(cuerpo).not.toHaveProperty("razonSocial");
    expect(cliente.autenticar).toHaveBeenCalled();
  });

  it("una jurídica manda su propio bloque de campos", async () => {
    await registrarYEntrar({
      tipo: "JURIDICA",
      cuit: "30712345678",
      password: "clave-larga",
      razonSocial: "Kiosco SRL",
      nombreFantasia: "El Kiosco",
      dni: "no corresponde",
    });
    const cuerpo = cliente.post.mock.calls[0][1];
    expect(cuerpo.razonSocial).toBe("Kiosco SRL");
    expect(cuerpo).not.toHaveProperty("dni");
  });

  it("salir descarta la sesión aunque el backend falle", async () => {
    // El logout del backend no revoca nada; lo que corta el acceso es esto.
    cliente.pedir.mockRejectedValue(new Error("sin red"));
    await salir();
    expect(cerrarSesion).toHaveBeenCalled();
  });
});
