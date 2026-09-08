import { beforeEach, describe, expect, it, vi } from "vitest";

const cliente = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), pedir: vi.fn() };
vi.mock("../cliente", () => ({
  get: (...a) => cliente.get(...a),
  post: (...a) => cliente.post(...a),
  patch: (...a) => cliente.patch(...a),
  pedir: (...a) => cliente.pedir(...a),
}));

const {
  cambiarEstadoSolicitud,
  crearSolicitud,
  listarSolicitudes,
  obtenerSolicitud,
  revisarArchivo,
  subirDocumento,
  subirVersion,
  validarDocumento,
} = await import("./documentacion");

function archivoFalso(nombre, { tipo = "application/pdf", bytes = 1024 } = {}) {
  const f = new File([new Uint8Array(bytes)], nombre, { type: tipo });
  return f;
}

beforeEach(() => {
  Object.values(cliente).forEach((m) => m.mockReset());
  cliente.get.mockResolvedValue({ items: [] });
  cliente.post.mockResolvedValue({});
  cliente.patch.mockResolvedValue({});
  cliente.pedir.mockResolvedValue({});
});

describe("revisarArchivo", () => {
  it("acepta las extensiones que acepta el backend", () => {
    for (const nombre of ["dni.pdf", "foto.JPG", "foto.jpeg", "img.png", "img.webp"]) {
      expect(revisarArchivo(archivoFalso(nombre)), nombre).toBeNull();
    }
  });

  it("rechaza una extensión que el backend no acepta", () => {
    expect(revisarArchivo(archivoFalso("planilla.xlsx"))).toMatch(/sólo se aceptan/i);
  });

  it("rechaza un archivo sin extensión", () => {
    expect(revisarArchivo(archivoFalso("sinextension"))).toMatch(/sólo se aceptan/i);
  });

  it("corta antes de subir lo que el backend devolvería como 413", () => {
    // Esperar toda la subida para recibir un 413 es la peor forma de
    // enterarse: el límite se chequea acá.
    const grande = archivoFalso("escaneo.pdf", { bytes: 10 * 1024 * 1024 + 1 });
    expect(revisarArchivo(grande)).toMatch(/10 MB/);
  });

  it("acepta exactamente el límite", () => {
    expect(revisarArchivo(archivoFalso("justo.pdf", { bytes: 10 * 1024 * 1024 }))).toBeNull();
  });

  it("rechaza un archivo vacío", () => {
    expect(revisarArchivo(archivoFalso("vacio.pdf", { bytes: 0 }))).toMatch(/vacío/i);
  });

  it("pide un archivo si no hay ninguno", () => {
    expect(revisarArchivo(null)).toMatch(/elegí un archivo/i);
  });
});

describe("subida multipart", () => {
  it("usa el nombre de campo que espera el backend", async () => {
    await subirDocumento(3, { archivo: archivoFalso("dni.pdf"), tipoDocumento: "DNI" });

    const [ruta, opciones] = cliente.pedir.mock.calls[0];
    expect(ruta).toBe("/personas/3/documentos");
    expect(opciones.metodo).toBe("POST");
    expect(opciones.form.get("archivo")).toBeInstanceOf(File);
    expect(opciones.form.get("tipoDocumento")).toBe("DNI");
    // Nunca se fija Content-Type: lo pone el navegador con su boundary.
    expect(opciones).not.toHaveProperty("cuerpo");
  });

  it("la nueva versión manda sólo el archivo", async () => {
    await subirVersion(7, archivoFalso("dni-v2.pdf"));

    const [ruta, opciones] = cliente.pedir.mock.calls[0];
    expect(ruta).toBe("/documentos/7/version");
    expect([...opciones.form.keys()]).toEqual(["archivo"]);
  });
});

describe("solicitudes", () => {
  it("desenvuelve el listado", async () => {
    cliente.get.mockResolvedValue({ items: [{ solicitudId: 1 }] });
    await expect(listarSolicitudes()).resolves.toEqual([{ solicitudId: 1 }]);
  });

  it("devuelve un array vacío si no vienen items", async () => {
    cliente.get.mockResolvedValue(null);
    await expect(listarSolicitudes()).resolves.toEqual([]);
  });

  it("arma la ruta del detalle", async () => {
    await obtenerSolicitud(4);
    expect(cliente.get).toHaveBeenCalledWith("/solicitudes-documentacion/4", undefined);
  });

  it("filtra el cuerpo del alta", async () => {
    await crearSolicitud({
      titularId: 3,
      tipoDocumento: "DNI",
      plazo: "2099-01-01",
      origen: "INTERNA",
      basura: "x",
    });
    expect(cliente.post).toHaveBeenCalledWith("/solicitudes-documentacion", {
      titularId: 3,
      tipoDocumento: "DNI",
      plazo: "2099-01-01",
      origen: "INTERNA",
    });
  });

  it("al cumplir una solicitud manda el documentoId, que el backend exige", async () => {
    await cambiarEstadoSolicitud(9, { estado: "CUMPLIDA", documentoId: 7 });
    expect(cliente.patch).toHaveBeenCalledWith("/solicitudes-documentacion/9/estado", {
      estado: "CUMPLIDA",
      documentoId: 7,
    });
  });
});

describe("validación de documentos", () => {
  it("manda aprobado y la vigencia", async () => {
    await validarDocumento(5, { aprobado: true, vigenciaHasta: "2030-01-01" });
    expect(cliente.patch).toHaveBeenCalledWith("/documentos/5/validar", {
      aprobado: true,
      vigenciaHasta: "2030-01-01",
    });
  });

  it("omite la vigencia cuando no se define", async () => {
    await validarDocumento(5, { aprobado: false });
    expect(cliente.patch).toHaveBeenCalledWith("/documentos/5/validar", { aprobado: false });
  });
});
