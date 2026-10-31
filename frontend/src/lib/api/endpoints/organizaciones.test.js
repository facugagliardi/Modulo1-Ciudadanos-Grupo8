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
  aprobarOrganizacion,
  buscarPorCuit,
  cambiarEstadoOrganizacion,
  crearOrganizacion,
  listarDuenos,
  listarOrganizaciones,
  listarOrganizacionesPendientes,
  listarOrganizacionesDeDueno,
  listarPropiedadesDeOrganizacion,
  actualizarDueno,
  obtenerOrganizacion,
  quitarDueno,
  rechazarOrganizacion,
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
  it("consulta las organizaciones del dueño con cancelación y conserva los porcentajes", async () => {
    const senal = new AbortController().signal;
    const items = [{ organizacionId: 7, porcentajeTitularidad: 30 }];
    cliente.get.mockResolvedValue({ items });
    await expect(listarOrganizacionesDeDueno(3, senal)).resolves.toEqual(items);
    expect(cliente.get).toHaveBeenCalledWith("/ciudadanos/3/organizaciones", senal);
  });

  it("usa la ruta anterior de personas únicamente cuando ciudadanos devuelve 404", async () => {
    cliente.get.mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce({ items: [{ organizacionId: 7 }] });
    await expect(listarOrganizacionesDeDueno(3)).resolves.toEqual([{ organizacionId: 7 }]);
    expect(cliente.get).toHaveBeenNthCalledWith(2, "/personas/3/organizaciones", undefined);
  });

  it("propaga los fallos de permisos sin probar una ruta alternativa", async () => {
    const error = { status: 403 };
    cliente.get.mockRejectedValue(error);
    await expect(listarOrganizacionesDeDueno(3)).rejects.toBe(error);
    expect(cliente.get).toHaveBeenCalledTimes(1);
  });

  it("tolera listados vacíos en pendientes, dominios y la ruta anterior", async () => {
    cliente.get.mockResolvedValue(null);
    await expect(listarOrganizacionesPendientes()).resolves.toEqual([]);
    await expect(listarOrganizacionesDeDueno(3)).resolves.toEqual([]);
    await expect(listarPropiedadesDeOrganizacion(7)).resolves.toEqual([]);
    cliente.get.mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce(null);
    await expect(listarOrganizacionesDeDueno(3)).resolves.toEqual([]);
  });

  it("actualiza la titularidad sin enviar datos del ciudadano", async () => {
    await actualizarDueno(7, 3, 30);
    expect(cliente.put).toHaveBeenCalledWith("/organizaciones/7/duenos/3", { porcentajeTitularidad: 30 });
  });
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

    await listarOrganizacionesPendientes();
    expect(cliente.get).toHaveBeenCalledWith("/organizaciones/pendientes", undefined);

    await aprobarOrganizacion(5);
    expect(cliente.patch).toHaveBeenCalledWith("/organizaciones/5/aprobar");

    await rechazarOrganizacion(5);
    expect(cliente.patch).toHaveBeenCalledWith("/organizaciones/5/rechazar");

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
  it("el alta normaliza el CUIT y filtra campos desconocidos", async () => {
    await crearOrganizacion({
      cuit: "30-71234567-8",
      razonSocial: "Kiosco SRL",
      nombreFantasia: "El Kiosco",
      tipo: "SRL",
      basura: "x",
    });
    expect(cliente.post).toHaveBeenCalledWith("/organizaciones", {
      cuit: "30712345678",
      razonSocial: "Kiosco SRL",
      nombreFantasia: "El Kiosco",
      tipo: "SRL",
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

  it("agregar dueño manda ciudadano y porcentaje", async () => {
    await agregarDueno(1, { ciudadanoId: 4, porcentajeTitularidad: 40, sobra: true });
    expect(cliente.post).toHaveBeenCalledWith("/organizaciones/1/duenos", {
      ciudadanoId: 4,
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
      ciudadanoId: 3,
      organizacionId: 1,
      alcance: "TOTAL",
      desde: "2026-09-06",
      hasta: null,
      sobra: "x",
    });
    expect(cliente.post).toHaveBeenCalledWith("/representaciones", {
      ciudadanoId: 3,
      organizacionId: 1,
      alcance: "TOTAL",
      desde: "2026-09-06",
      hasta: null,
    });
  });
});
