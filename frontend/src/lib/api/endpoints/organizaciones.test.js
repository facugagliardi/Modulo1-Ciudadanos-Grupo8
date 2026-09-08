import { beforeEach, describe, expect, it, vi } from "vitest";

const cliente = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
vi.mock("../cliente", () => ({
  get: (...a) => cliente.get(...a),
  post: (...a) => cliente.post(...a),
  put: (...a) => cliente.put(...a),
  patch: (...a) => cliente.patch(...a),
  del: (...a) => cliente.del(...a),
}));

const {
  agregarDueno,
  actualizarOrganizacion,
  buscarPorCuit,
  cambiarEstadoOrganizacion,
  crearOrganizacion,
  listarDuenos,
  listarOrganizaciones,
  obtenerOrganizacion,
  quitarDueno,
} = await import("./organizaciones");

const {
  cambiarEstadoRepresentacion,
  crearRepresentacion,
  listarRepresentacionesDeOrganizacion,
} = await import("./representaciones");

beforeEach(() => {
  Object.values(cliente).forEach((m) => m.mockReset());
  cliente.get.mockResolvedValue({ items: [] });
  cliente.post.mockResolvedValue({});
  cliente.put.mockResolvedValue({});
  cliente.patch.mockResolvedValue({});
  cliente.del.mockResolvedValue(null);
});

describe("listados", () => {
  it("desenvuelven {items:[…]}", async () => {
    cliente.get.mockResolvedValue({ items: [{ organizacionId: 1 }] });
    await expect(listarOrganizaciones()).resolves.toEqual([{ organizacionId: 1 }]);
  });

  it("devuelven array vacío si la respuesta no trae items", async () => {
    cliente.get.mockResolvedValue(null);
    await expect(listarOrganizaciones()).resolves.toEqual([]);
    await expect(listarDuenos(1)).resolves.toEqual([]);
    await expect(listarRepresentacionesDeOrganizacion(1)).resolves.toEqual([]);
  });
});

describe("rutas", () => {
  it("arma las rutas de organizaciones", async () => {
    await obtenerOrganizacion(3);
    expect(cliente.get).toHaveBeenCalledWith("/organizaciones/3", undefined);

    await listarDuenos(3);
    expect(cliente.get).toHaveBeenCalledWith("/organizaciones/3/duenos", undefined);

    await quitarDueno(3, 7);
    expect(cliente.del).toHaveBeenCalledWith("/organizaciones/3/duenos/7");
  });

  it("normaliza el CUIT en la búsqueda", async () => {
    await buscarPorCuit("30-71234567-8");
    expect(cliente.get).toHaveBeenCalledWith("/organizaciones/cuit/30712345678", undefined);
  });

  it("arma las rutas de representaciones", async () => {
    await listarRepresentacionesDeOrganizacion(5);
    expect(cliente.get).toHaveBeenCalledWith("/organizaciones/5/representaciones", undefined);
  });
});

describe("cuerpos filtrados", () => {
  it("el alta manda los dueños como objetos y normaliza el CUIT", async () => {
    // ARCHITECTURE.md dice `personaId[]`; el backend recibe objetos.
    await crearOrganizacion({
      cuit: "30-71234567-8",
      razonSocial: "Kiosco SRL",
      nombreFantasia: "El Kiosco",
      tipo: "SRL",
      duenos: [{ personaId: 1, porcentajeTitularidad: 60 }],
      basura: "x",
    });
    expect(cliente.post).toHaveBeenCalledWith("/organizaciones", {
      cuit: "30712345678",
      razonSocial: "Kiosco SRL",
      nombreFantasia: "El Kiosco",
      tipo: "SRL",
      duenos: [{ personaId: 1, porcentajeTitularidad: 60 }],
    });
  });

  it("la edición NO deja cambiar el CUIT", async () => {
    // El CUIT identifica a la organización ante todo el municipio.
    await actualizarOrganizacion(1, {
      razonSocial: "Otra SRL",
      nombreFantasia: "Otro",
      tipo: "SA",
      cuit: "30999999999",
      estado: "BLOQUEADA",
    });
    const enviado = cliente.put.mock.calls[0][1];
    expect(enviado).toEqual({ razonSocial: "Otra SRL", nombreFantasia: "Otro", tipo: "SA" });
    expect(enviado).not.toHaveProperty("cuit");
    expect(enviado).not.toHaveProperty("estado");
  });

  it("agregar dueño manda persona y porcentaje", async () => {
    await agregarDueno(1, { personaId: 4, porcentajeTitularidad: 40, sobra: true });
    expect(cliente.post).toHaveBeenCalledWith("/organizaciones/1/duenos", {
      personaId: 4,
      porcentajeTitularidad: 40,
    });
  });

  it("los cambios de estado mandan sólo {estado}", async () => {
    await cambiarEstadoOrganizacion(1, "INACTIVA");
    expect(cliente.patch).toHaveBeenCalledWith("/organizaciones/1/estado", { estado: "INACTIVA" });

    await cambiarEstadoRepresentacion(2, "REVOCADA");
    expect(cliente.patch).toHaveBeenCalledWith("/representaciones/2/estado", { estado: "REVOCADA" });
  });

  it("la representación acepta hasta nulo como 'sin vencimiento'", async () => {
    await crearRepresentacion({
      personaId: 3,
      organizacionId: 1,
      alcance: "TOTAL",
      desde: "2026-09-06",
      hasta: null,
      sobra: "x",
    });
    expect(cliente.post).toHaveBeenCalledWith("/representaciones", {
      personaId: 3,
      organizacionId: 1,
      alcance: "TOTAL",
      desde: "2026-09-06",
      hasta: null,
    });
  });
});
