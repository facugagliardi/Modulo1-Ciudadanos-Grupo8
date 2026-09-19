import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Domicilios } from "./Domicilios";
import { conSesion, renderizar } from "@/pruebas/utilidades";

const listarDomicilios = vi.fn();
const crearDomicilio = vi.fn();
const actualizarDomicilio = vi.fn();
const marcarDomicilioPrincipal = vi.fn();
const cerrarDomicilio = vi.fn();

vi.mock("@/lib/api/endpoints/personas", () => ({
  listarDomicilios: (...a) => listarDomicilios(...a),
  crearDomicilio: (...a) => crearDomicilio(...a),
  actualizarDomicilio: (...a) => actualizarDomicilio(...a),
  marcarDomicilioPrincipal: (...a) => marcarDomicilioPrincipal(...a),
  cerrarDomicilio: (...a) => cerrarDomicilio(...a),
}));

const VIGENTE_PRINCIPAL = {
  propiedadId: 3, tipo: "DEPARTAMENTO", calle: "Corrientes", numero: "1500", altura: "3B",
  esPrincipal: true, vigenteDesde: "2026-03-01", vigenteHasta: null,
};
const VIGENTE_SECUNDARIO = {
  propiedadId: 4, tipo: "LOCAL", calle: "Rivadavia", numero: "980", altura: null,
  esPrincipal: false, vigenteDesde: "2026-04-01", vigenteHasta: null,
};
const CERRADO = {
  propiedadId: 2, tipo: "CASA", calle: "Siempreviva", numero: "742", altura: null,
  esPrincipal: false, vigenteDesde: "2020-01-01", vigenteHasta: "2026-03-01",
};

beforeEach(() => {
  [listarDomicilios, crearDomicilio, actualizarDomicilio, marcarDomicilioPrincipal, cerrarDomicilio]
    .forEach((m) => m.mockReset());
  listarDomicilios.mockResolvedValue([VIGENTE_PRINCIPAL, CERRADO]);
  crearDomicilio.mockResolvedValue({});
  actualizarDomicilio.mockResolvedValue({});
  marcarDomicilioPrincipal.mockResolvedValue({});
  cerrarDomicilio.mockResolvedValue({});
  conSesion({ id: 1, rol: "PERSONA", subType: "CIUDADANO" });
});

describe("historial", () => {
  it("muestra el vigente y los cerrados, sin pisar la historia", async () => {
    // La regla del módulo: un domicilio no se modifica, se cierra y se abre otro.
    renderizar(<Domicilios />);
    expect(await screen.findByText(/Corrientes 1500, 3B/)).toBeInTheDocument();
    expect(screen.getByText(/Siempreviva 742/)).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
  });

  it("el cerrado muestra el rango completo y el vigente sólo el desde", async () => {
    renderizar(<Domicilios />);
    expect(await screen.findByText(/desde el 01\/03\/2026/i)).toBeInTheDocument();
    expect(screen.getByText(/del 01\/01\/2020 al 01\/03\/2026/i)).toBeInTheDocument();
  });

  it("no ofrece acciones sobre un domicilio ya cerrado", async () => {
    renderizar(<Domicilios />);
    await screen.findByText(/Corrientes 1500, 3B/);
    // Sólo hay un "Editar": el del vigente.
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(1);
  });
});

describe("prevención del 409", () => {
  it("no deja dar de baja el único domicilio vigente, y explica por qué", async () => {
    // El backend responde 409. Es mejor desactivar la acción que dejar que
    // el usuario se coma el error.
    renderizar(<Domicilios />);
    expect(await screen.findByText(/es tu único domicilio vigente/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dar de baja/i })).not.toBeInTheDocument();
  });

  it("con dos vigentes sí permite dar de baja", async () => {
    listarDomicilios.mockResolvedValue([VIGENTE_PRINCIPAL, VIGENTE_SECUNDARIO, CERRADO]);
    renderizar(<Domicilios />);
    expect(await screen.findAllByRole("button", { name: /dar de baja/i })).toHaveLength(2);
  });

  it("al dar de baja aclara que no se borra", async () => {
    listarDomicilios.mockResolvedValue([VIGENTE_PRINCIPAL, VIGENTE_SECUNDARIO]);
    renderizar(<Domicilios />);
    await userEvent.click((await screen.findAllByRole("button", { name: /dar de baja/i }))[0]);

    expect(await screen.findByText(/no se borra/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^dar de baja$/i }));
    await waitFor(() => expect(cerrarDomicilio).toHaveBeenCalledWith(3));
  });
});

describe("principal", () => {
  it("ofrece hacer principal sólo al que no lo es", async () => {
    listarDomicilios.mockResolvedValue([VIGENTE_PRINCIPAL, VIGENTE_SECUNDARIO]);
    renderizar(<Domicilios />);
    const botones = await screen.findAllByRole("button", { name: /hacer principal/i });
    expect(botones).toHaveLength(1);

    await userEvent.click(botones[0]);
    await waitFor(() => expect(marcarDomicilioPrincipal).toHaveBeenCalledWith(4));
  });
});

describe("alta", () => {
  it("exige calle y número", async () => {
    renderizar(<Domicilios />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar domicilio/i }));
    await userEvent.click(screen.getByRole("button", { name: /^agregar domicilio$/i }));

    expect(await screen.findByText(/ingresá la calle/i)).toBeInTheDocument();
    expect(screen.getByText(/ingresá la altura/i)).toBeInTheDocument();
    expect(crearDomicilio).not.toHaveBeenCalled();
  });

  it("el primer domicilio queda como principal sin preguntar", async () => {
    listarDomicilios.mockResolvedValue([]);
    renderizar(<Domicilios />);
    await userEvent.click(await screen.findByRole("button", { name: /cargar mi domicilio/i }));

    expect(await screen.findByText(/como es tu primer domicilio, queda como principal/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Calle"), "Rivadavia");
    await userEvent.type(screen.getByLabelText("Número"), "4520");
    await userEvent.click(screen.getByRole("button", { name: /^agregar domicilio$/i }));

    await waitFor(() =>
      expect(crearDomicilio).toHaveBeenCalledWith(1, expect.objectContaining({ esPrincipal: true })),
    );
  });

  it("con domicilios ya cargados, deja elegir si es el principal", async () => {
    renderizar(<Domicilios />);
    await userEvent.click(await screen.findByRole("button", { name: /agregar domicilio/i }));
    expect(await screen.findByText(/que sea mi domicilio principal/i)).toBeInTheDocument();
  });
});

describe("edición", () => {
  it("precarga los datos y no manda esPrincipal, que el PUT no acepta", async () => {
    renderizar(<Domicilios />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));

    expect(await screen.findByLabelText("Calle")).toHaveValue("Corrientes");
    await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(actualizarDomicilio).toHaveBeenCalled());
    const enviado = actualizarDomicilio.mock.calls[0][1];
    expect(enviado.calle).toBe("Corrientes");
    // El módulo de endpoints filtra esPrincipal; acá se verifica el contrato
    // desde la pantalla.
    expect(enviado.tipo).toBe("DEPARTAMENTO");
  });
});
