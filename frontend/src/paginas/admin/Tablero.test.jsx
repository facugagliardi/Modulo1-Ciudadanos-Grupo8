import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tablero, calcularMetricas } from "./Tablero";
import { conSesion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const listarCiudadanos = vi.fn();
const listarOrganizaciones = vi.fn();
const listarExpedientes = vi.fn();
const listarSolicitudes = vi.fn();

vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  listarCiudadanos: (...a) => listarCiudadanos(...a),
}));
vi.mock("@/lib/api/endpoints/organizaciones", () => ({
  listarOrganizaciones: (...a) => listarOrganizaciones(...a),
}));
vi.mock("@/lib/api/endpoints/expedientes", () => ({
  listarExpedientes: (...a) => listarExpedientes(...a),
}));
vi.mock("@/lib/api/endpoints/documentacion", () => ({
  listarSolicitudes: (...a) => listarSolicitudes(...a),
}));

const HOY = new Date();
const enDias = (n) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const CIUDADANOS = [
  { id: 1, estado: "ACTIVO" },
  { id: 2, estado: "ACTIVO" },
  { id: 3, estado: "INACTIVO" },
  { id: 4, estado: "FALLECIDO" },
];
const ORGANIZACIONES = [
  { organizacionId: 1, tipo: "SRL", estado: "ACTIVA" },
  { organizacionId: 2, tipo: "SRL", estado: "ACTIVA" },
  { organizacionId: 3, tipo: "COOPERATIVA", estado: "INACTIVA" },
];
const EXPEDIENTES = [
  { expedienteId: 1, estado: "INICIADO", areaIniciadora: "Obras", actuacionesCount: 0 },
  { expedienteId: 2, estado: "EN_TRAMITE", areaIniciadora: "Obras", actuacionesCount: 3 },
  { expedienteId: 3, estado: "ARCHIVADO", areaIniciadora: "Rentas", actuacionesCount: 0 },
  { expedienteId: 4, estado: "RESUELTO", areaIniciadora: "Habilitaciones", actuacionesCount: 2 },
];
const SOLICITUDES = [
  { solicitudId: 1, estado: "PENDIENTE", plazo: enDias(-5) },
  { solicitudId: 2, estado: "PENDIENTE", plazo: enDias(3) },
  { solicitudId: 3, estado: "PENDIENTE", plazo: enDias(30) },
  { solicitudId: 4, estado: "CUMPLIDA", plazo: enDias(-10) },
];

beforeEach(() => {
  [listarCiudadanos, listarOrganizaciones, listarExpedientes, listarSolicitudes].forEach((m) =>
    m.mockReset(),
  );
  listarCiudadanos.mockResolvedValue(CIUDADANOS);
  listarOrganizaciones.mockResolvedValue(ORGANIZACIONES);
  listarExpedientes.mockResolvedValue(EXPEDIENTES);
  listarSolicitudes.mockResolvedValue(SOLICITUDES);
  conSesion({ rol: "RESPONSABLE_AREA", subType: "EMPLEADO" });
});

describe("aritmética de los indicadores", () => {
  const m = () =>
    calcularMetricas({
      ciudadanos: CIUDADANOS,
      organizaciones: ORGANIZACIONES,
      expedientes: EXPEDIENTES,
      solicitudes: SOLICITUDES,
    });

  it("cuenta los totales", () => {
    expect(m().totalVecinos).toBe(4);
    expect(m().vecinosActivos).toBe(2);
    expect(m().totalOrganizaciones).toBe(3);
    expect(m().totalExpedientes).toBe(4);
  });

  it("un expediente archivado sin actuaciones NO cuenta como estancado", () => {
    // Estancado es "abierto y nadie hizo nada". Un archivado está cerrado,
    // no abandonado. Sin esta distinción el indicador miente.
    expect(m().expedientesEstancados).toBe(1);
  });

  it("sólo cuenta como vencida una solicitud que además sigue pendiente", () => {
    // La #4 venció hace 10 días pero ya se cumplió: no reclama nada.
    expect(m().solicitudesVencidas).toBe(1);
  });

  it("las que vencen esta semana excluyen a las ya vencidas", () => {
    expect(m().solicitudesPorVencer).toBe(1);
  });

  it("agrupa los estados en el orden del recorrido, no alfabético", () => {
    // El padrón se lee ACTIVO → INACTIVO → BLOQUEADO → FALLECIDO.
    expect(m().vecinosPorEstado.map((d) => d.clave)).toEqual([
      "ACTIVO",
      "INACTIVO",
      "FALLECIDO",
    ]);
    // El expediente sigue su embudo.
    expect(m().expedientesPorEstado.map((d) => d.clave)).toEqual([
      "INICIADO",
      "EN_TRAMITE",
      "RESUELTO",
      "ARCHIVADO",
    ]);
  });

  it("omite los estados sin ninguna fila", () => {
    // No hay bloqueados: no se dibuja una barra en cero.
    expect(m().vecinosPorEstado.map((d) => d.clave)).not.toContain("BLOQUEADO");
  });

  it("ordena las categorías nominales de mayor a menor", () => {
    // Comparar magnitud es el trabajo del gráfico; sin orden se esconde.
    expect(m().expedientesPorArea.map((d) => [d.clave, d.valor])).toEqual([
      ["Obras", 2],
      ["Rentas", 1],
      ["Habilitaciones", 1],
    ]);
  });

  it("traduce los tipos de organización al castellano", () => {
    expect(m().organizacionesPorTipo[0]).toMatchObject({ clave: "SRL", valor: 2, etiquetaTexto: "S.R.L." });
  });

  it("no explota con todo vacío", () => {
    const vacio = calcularMetricas({
      ciudadanos: [], organizaciones: [], expedientes: [], solicitudes: [],
    });
    expect(vacio.totalVecinos).toBe(0);
    expect(vacio.expedientesEstancados).toBe(0);
    expect(vacio.vecinosPorEstado).toEqual([]);
  });
});

describe("la pantalla", () => {
  it("encabeza con el tamaño del padrón", async () => {
    renderizar(<Tablero />);
    expect(await screen.findByText("Padrón municipal")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/2 activos · 3 organizaciones · 4 expedientes/i)).toBeInTheDocument();
  });

  it("pone lo que reclama acción antes que la composición", async () => {
    renderizar(<Tablero />);
    const atencion = await screen.findByRole("heading", { name: /requiere atención/i });
    const composicion = screen.getByRole("heading", { name: /composición/i });
    // compareDocumentPosition: 4 = "el segundo va después del primero".
    expect(atencion.compareDocumentPosition(composicion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("ofrece ir a la sección cuando hay algo pendiente", async () => {
    renderizar(<Tablero />);
    expect(await screen.findByRole("link", { name: /ver expedientes/i })).toHaveAttribute(
      "href",
      "/admin/expedientes",
    );
  });

  it("cuando no hay nada pendiente lo dice en positivo, sin ofrecer acción", async () => {
    listarSolicitudes.mockResolvedValue([]);
    listarExpedientes.mockResolvedValue([
      { expedienteId: 1, estado: "EN_TRAMITE", areaIniciadora: "Obras", actuacionesCount: 2 },
    ]);
    renderizar(<Tablero />);

    expect(await screen.findByText(/todos los expedientes abiertos tienen movimiento/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ver expedientes/i })).not.toBeInTheDocument();
  });

  it("si falla una consulta, el resto del tablero se sigue viendo", async () => {
    listarOrganizaciones.mockRejectedValue(new ErrorApi({ status: 500, message: "Error interno" }));
    renderizar(<Tablero />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no pudimos cargar las organizaciones/i);
    // El padrón igual se calculó.
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

describe("los gráficos", () => {
  it("cada uno tiene su tabla gemela con recuento y porcentaje", async () => {
    // Un gráfico sin equivalente accesible deja el dato fuera de alcance.
    renderizar(<Tablero />);
    const seccion = await screen.findByRole("region", { name: /vecinos por estado/i });
    await userEvent.click(within(seccion).getByRole("button", { name: /ver tabla/i }));

    const tabla = within(seccion).getByRole("table");
    expect(within(tabla).getByRole("columnheader", { name: "Cantidad" })).toBeInTheDocument();
    expect(within(tabla).getByRole("columnheader", { name: "Porcentaje" })).toBeInTheDocument();
    expect(within(tabla).getByRole("rowheader", { name: "Activo" })).toBeInTheDocument();
  });

  it("vuelve al gráfico desde la tabla", async () => {
    renderizar(<Tablero />);
    const seccion = await screen.findByRole("region", { name: /vecinos por estado/i });
    await userEvent.click(within(seccion).getByRole("button", { name: /ver tabla/i }));
    await userEvent.click(within(seccion).getByRole("button", { name: /ver gráfico/i }));
    expect(within(seccion).queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra el valor al lado de la barra, no sólo al pasar el mouse", async () => {
    // Un dato que sólo se lee con el mouse no existe para quien usa teclado.
    renderizar(<Tablero />);
    const seccion = await screen.findByRole("region", { name: /expedientes por área/i });
    expect(within(seccion).getByText("Obras")).toBeInTheDocument();
    expect(within(seccion).getAllByText("50%").length).toBeGreaterThan(0);
  });

  it("avisa cuando una categoría no tiene datos", async () => {
    listarOrganizaciones.mockResolvedValue([]);
    renderizar(<Tablero />);
    expect(await screen.findByText(/no hay organizaciones registradas/i)).toBeInTheDocument();
  });
});
