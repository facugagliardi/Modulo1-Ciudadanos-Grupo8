import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetalleOrganizacion } from "./DetalleOrganizacion";
import { NuevaOrganizacion } from "./NuevaOrganizacion";
import { Organizaciones } from "../admin/Organizaciones";
import { MisOrganizaciones } from "../portal/MisOrganizaciones";
import { conSesion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const navegar = vi.fn();
vi.mock("react-router-dom", async () => {
  const real = await vi.importActual("react-router-dom");
  return { ...real, useNavigate: () => navegar };
});

const listarOrganizaciones = vi.fn();
const obtenerOrganizacion = vi.fn();
const crearOrganizacion = vi.fn();
const actualizarOrganizacion = vi.fn();
const cambiarEstadoOrganizacion = vi.fn();
const buscarPorCuit = vi.fn();
const agregarDueno = vi.fn();
const quitarDueno = vi.fn();
const listarRepresentacionesDeOrganizacion = vi.fn();
const crearRepresentacion = vi.fn();
const cambiarEstadoRepresentacion = vi.fn();
const listarRepresentaciones = vi.fn();
const buscarPorDni = vi.fn();

vi.mock("@/lib/api/endpoints/organizaciones", () => ({
  listarOrganizaciones: (...a) => listarOrganizaciones(...a),
  obtenerOrganizacion: (...a) => obtenerOrganizacion(...a),
  crearOrganizacion: (...a) => crearOrganizacion(...a),
  actualizarOrganizacion: (...a) => actualizarOrganizacion(...a),
  cambiarEstadoOrganizacion: (...a) => cambiarEstadoOrganizacion(...a),
  buscarPorCuit: (...a) => buscarPorCuit(...a),
  agregarDueno: (...a) => agregarDueno(...a),
  quitarDueno: (...a) => quitarDueno(...a),
}));
vi.mock("@/lib/api/endpoints/representaciones", () => ({
  listarRepresentacionesDeOrganizacion: (...a) => listarRepresentacionesDeOrganizacion(...a),
  crearRepresentacion: (...a) => crearRepresentacion(...a),
  cambiarEstadoRepresentacion: (...a) => cambiarEstadoRepresentacion(...a),
}));
vi.mock("@/lib/api/endpoints/personas", () => ({
  listarRepresentaciones: (...a) => listarRepresentaciones(...a),
}));
vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  buscarPorDni: (...a) => buscarPorDni(...a),
}));

const ORG = {
  organizacionId: 1, cuit: "30712345678", taxId: "30712345678",
  razonSocial: "Kiosco del Barrio SRL", nombreFantasia: "El Kiosco", tipo: "SRL",
  estado: "ACTIVA", creadoEn: "2026-09-06T18:00:00-03:00", domicilioPrincipal: null,
  duenos: [
    { personaId: 1, dni: "34567890", nombre: "Diego", apellido: "Lopez", porcentajeTitularidad: 60 },
  ],
  representantesVigentes: [],
};

const REPRESENTACIONES = [
  { representacionId: 1, personaId: 2, nombre: "Ana", apellido: "Pérez",
    alcance: "TOTAL", desde: "2026-09-06", hasta: null, estado: "VIGENTE" },
  { representacionId: 2, personaId: 3, nombre: "Carla", apellido: "Molina",
    alcance: "TRAMITES", desde: "2026-01-01", hasta: "2026-06-01", estado: "VENCIDA" },
];

function detalle(zona = "admin") {
  return renderizar(<DetalleOrganizacion zona={zona} />, {
    ruta: `/${zona}/organizaciones/1`,
    patron: `/${zona}/organizaciones/:id`,
  });
}

beforeEach(() => {
  navegar.mockClear();
  [listarOrganizaciones, obtenerOrganizacion, crearOrganizacion, actualizarOrganizacion,
   cambiarEstadoOrganizacion, buscarPorCuit, agregarDueno, quitarDueno,
   listarRepresentacionesDeOrganizacion, crearRepresentacion, cambiarEstadoRepresentacion,
   listarRepresentaciones, buscarPorDni].forEach((m) => m.mockReset());

  listarOrganizaciones.mockResolvedValue([ORG]);
  obtenerOrganizacion.mockResolvedValue(ORG);
  crearOrganizacion.mockResolvedValue({ organizacionId: 9 });
  actualizarOrganizacion.mockResolvedValue({});
  cambiarEstadoOrganizacion.mockResolvedValue({});
  buscarPorCuit.mockResolvedValue({ existe: false });
  agregarDueno.mockResolvedValue({});
  quitarDueno.mockResolvedValue(null);
  listarRepresentacionesDeOrganizacion.mockResolvedValue(REPRESENTACIONES);
  crearRepresentacion.mockResolvedValue({});
  cambiarEstadoRepresentacion.mockResolvedValue({});
  listarRepresentaciones.mockResolvedValue([]);
  buscarPorDni.mockResolvedValue({ existe: true, id: 5, nombre: "Ana", apellido: "Pérez", dni: "40123456", estado: "ACTIVO" });
  conSesion({ id: 99, rol: "RESPONSABLE_AREA", subType: "EMPLEADO" });
});

describe("listado del backoffice", () => {
  it("muestra las organizaciones con el CUIT formateado", async () => {
    renderizar(<Organizaciones />);
    expect(await screen.findByText("Kiosco del Barrio SRL")).toBeInTheDocument();
    expect(screen.getByText("30-71234567-8")).toBeInTheDocument();
  });

  it("filtra por tipo societario", async () => {
    listarOrganizaciones.mockResolvedValue([ORG, { ...ORG, organizacionId: 2, razonSocial: "Coop El Sol", tipo: "COOPERATIVA" }]);
    renderizar(<Organizaciones />);
    await screen.findByText("Kiosco del Barrio SRL");
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "COOPERATIVA");

    expect(screen.getByText("Coop El Sol")).toBeInTheDocument();
    expect(screen.queryByText("Kiosco del Barrio SRL")).not.toBeInTheDocument();
  });
});

describe("detalle", () => {
  it("muestra los datos y las tres pestañas", async () => {
    detalle();
    expect(await screen.findByRole("heading", { name: /kiosco del barrio srl/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /dueños/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /representantes/i })).toBeInTheDocument();
  });

  it("el auditor no puede editar ni cambiar el estado", async () => {
    conSesion({ id: 99, rol: "AUDITOR", subType: "EMPLEADO" });
    detalle();
    await screen.findByRole("heading", { name: /kiosco/i });
    expect(screen.queryByRole("button", { name: /editar datos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cambiar estado/i })).not.toBeInTheDocument();
  });

  it("un dueño puede editar aunque no tenga permisos de empleado", async () => {
    // Regla del backend: sobre una organización mandan sus dueños y sus
    // representantes vigentes, además de quien tenga el permiso.
    conSesion({ id: 1, rol: "PERSONA", subType: "CIUDADANO" });
    detalle("portal");
    expect(await screen.findByRole("button", { name: /editar datos/i })).toBeInTheDocument();
  });

  it("alguien ajeno a la organización no puede editarla", async () => {
    conSesion({ id: 77, rol: "PERSONA", subType: "CIUDADANO" });
    detalle("portal");
    await screen.findByRole("heading", { name: /kiosco/i });
    expect(screen.queryByRole("button", { name: /editar datos/i })).not.toBeInTheDocument();
  });

  it("edita los datos sin tocar el CUIT", async () => {
    detalle();
    await userEvent.click(await screen.findByRole("button", { name: /editar datos/i }));

    const razon = await screen.findByLabelText(/razón social/i);
    await userEvent.clear(razon);
    await userEvent.type(razon, "Kiosco Renovado SRL");
    await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() =>
      expect(actualizarOrganizacion).toHaveBeenCalledWith(1, {
        razonSocial: "Kiosco Renovado SRL",
        nombreFantasia: "El Kiosco",
        tipo: "SRL",
      }),
    );
  });

  it("no deja guardar con la razón social vacía", async () => {
    detalle();
    await userEvent.click(await screen.findByRole("button", { name: /editar datos/i }));
    await userEvent.clear(await screen.findByLabelText(/razón social/i));
    await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByText(/no puede quedar vacía/i)).toBeInTheDocument();
    expect(actualizarOrganizacion).not.toHaveBeenCalled();
  });

  it("cambia el estado de la organización", async () => {
    detalle();
    await userEvent.click(await screen.findByRole("button", { name: /cambiar estado/i }));
    await userEvent.click(await screen.findByRole("radio", { name: /inactiva/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar cambio/i }));

    await waitFor(() => expect(cambiarEstadoOrganizacion).toHaveBeenCalledWith(1, "INACTIVA"));
  });

  it("ningún estado de organización es terminal", async () => {
    // A diferencia de un ciudadano fallecido, una organización siempre puede
    // volver: no hay candado en su badge.
    detalle();
    await userEvent.click(await screen.findByRole("button", { name: /cambiar estado/i }));
    expect(screen.queryByText(/no se puede deshacer/i)).not.toBeInTheDocument();
  });

  it("muestra el error del backend si falla la edición", async () => {
    actualizarOrganizacion.mockRejectedValue(
      new ErrorApi({ status: 403, message: "No tenés permiso" }),
    );
    detalle();
    await userEvent.click(await screen.findByRole("button", { name: /editar datos/i }));
    await userEvent.click(await screen.findByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no tenés permiso/i);
  });

  it("un representante vigente también puede editar", async () => {
    obtenerOrganizacion.mockResolvedValue({
      ...ORG,
      representantesVigentes: [{ personaId: 42, nombre: "Ana", apellido: "Pérez", alcance: "TOTAL" }],
    });
    conSesion({ id: 42, rol: "PERSONA", subType: "CIUDADANO" });
    detalle("portal");
    expect(await screen.findByRole("button", { name: /editar datos/i })).toBeInTheDocument();
  });
});

describe("dueños", () => {
  it("no deja quitar al único dueño, y lo explica", async () => {
    // El backend responde 409: una organización no puede quedarse sin dueños.
    detalle();
    await userEvent.click(await screen.findByRole("tab", { name: /dueños/i }));

    expect(await screen.findByText(/es el único dueño/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /quitar a diego/i })).not.toBeInTheDocument();
  });

  it("con dos dueños sí permite quitar uno", async () => {
    obtenerOrganizacion.mockResolvedValue({
      ...ORG,
      duenos: [...ORG.duenos, { personaId: 2, dni: "40123456", nombre: "Ana", apellido: "Pérez", porcentajeTitularidad: 40 }],
    });
    detalle();
    await userEvent.click(await screen.findByRole("tab", { name: /dueños/i }));
    await userEvent.click(await screen.findByRole("button", { name: /quitar a ana/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^quitar dueño$/i }));

    await waitFor(() => expect(quitarDueno).toHaveBeenCalledWith(1, 2));
  });

  it("avisa cuánta titularidad queda disponible", async () => {
    // 60% ya asignado: sólo quedan 40.
    detalle();
    await userEvent.click(await screen.findByRole("tab", { name: /dueños/i }));
    await userEvent.click(await screen.findByRole("button", { name: /agregar dueño/i }));
    await userEvent.type(await screen.findByLabelText(/dni del nuevo dueño/i), "40123456");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(/queda 40% disponible/i)).toBeInTheDocument();
  });

  it("no deja pasarse del 100% antes de llamar al backend", async () => {
    detalle();
    await userEvent.click(await screen.findByRole("tab", { name: /dueños/i }));
    await userEvent.click(await screen.findByRole("button", { name: /agregar dueño/i }));
    await userEvent.type(await screen.findByLabelText(/dni del nuevo dueño/i), "40123456");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await userEvent.type(await screen.findByLabelText(/porcentaje/i), "50");
    await userEvent.click(screen.getByRole("button", { name: /^agregar dueño$/i }));

    expect(await screen.findByText(/sólo queda 40%/i)).toBeInTheDocument();
    expect(agregarDueno).not.toHaveBeenCalled();
  });
});

describe("representaciones", () => {
  it("muestra el alcance y la vigencia de cada una", async () => {
    detalle();
    await userEvent.click(await screen.findByRole("tab", { name: /representantes/i }));

    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText(/alcance total · desde el 06\/09\/2026 · sin vencimiento/i)).toBeInTheDocument();
    expect(screen.getByText(/alcance trámites · desde el 01\/01\/2026 hasta el 01\/06\/2026/i)).toBeInTheDocument();
  });

  it("una representación vencida es terminal y no ofrece cambios", async () => {
    detalle();
    await userEvent.click(await screen.findByRole("tab", { name: /representantes/i }));
    // Sólo la vigente tiene botón de estado; la vencida es terminal.
    expect(await screen.findAllByRole("button", { name: "Estado" })).toHaveLength(1);
  });

  it("otorga una representación con los dos extremos de la vigencia", async () => {
    detalle();
    await userEvent.click(await screen.findByRole("tab", { name: /representantes/i }));
    await userEvent.click(await screen.findByRole("button", { name: /otorgar representación/i }));
    await userEvent.type(await screen.findByLabelText(/dni del representante/i), "40123456");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await userEvent.selectOptions(await screen.findByLabelText("Alcance"), "FIRMA");
    await userEvent.click(screen.getByRole("button", { name: /^otorgar representación$/i }));

    await waitFor(() => expect(crearRepresentacion).toHaveBeenCalled());
    const enviado = crearRepresentacion.mock.calls[0][0];
    expect(enviado.personaId).toBe(5);
    expect(enviado.organizacionId).toBe(1);
    expect(enviado.alcance).toBe("FIRMA");
    // Vacío se manda como null: el backend lo lee como "sin vencimiento".
    expect(enviado.hasta).toBeNull();
  });

  it("rechaza un vencimiento anterior al inicio", async () => {
    detalle();
    await userEvent.click(await screen.findByRole("tab", { name: /representantes/i }));
    await userEvent.click(await screen.findByRole("button", { name: /otorgar representación/i }));
    await userEvent.type(await screen.findByLabelText(/dni del representante/i), "40123456");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await userEvent.type(await screen.findByLabelText("Hasta"), "2020-01-01");
    await userEvent.click(screen.getByRole("button", { name: /^otorgar representación$/i }));

    expect(await screen.findByText(/no puede ser anterior al inicio/i)).toBeInTheDocument();
    expect(crearRepresentacion).not.toHaveBeenCalled();
  });

  it("explica el 409 de representación duplicada", async () => {
    crearRepresentacion.mockRejectedValue(new ErrorApi({ status: 409, message: "duplicate" }));
    detalle();
    await userEvent.click(await screen.findByRole("tab", { name: /representantes/i }));
    await userEvent.click(await screen.findByRole("button", { name: /otorgar representación/i }));
    await userEvent.type(await screen.findByLabelText(/dni del representante/i), "40123456");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await userEvent.click(await screen.findByRole("button", { name: /^otorgar representación$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya tiene una representación activa/i);
  });
});

describe("alta de organización", () => {
  it("exige CUIT, razón social y al menos un dueño", async () => {
    renderizar(<NuevaOrganizacion zona="admin" />);
    await userEvent.click(screen.getByRole("button", { name: /^registrar organización$/i }));

    expect(await screen.findByText(/ingresá el cuit/i)).toBeInTheDocument();
    expect(screen.getByText(/ingresá la razón social/i)).toBeInTheDocument();
    expect(screen.getByText(/agregá al menos un dueño/i)).toBeInTheDocument();
    expect(crearOrganizacion).not.toHaveBeenCalled();
  });

  it("avisa si el CUIT ya existe, sin esperar al 409", async () => {
    buscarPorCuit.mockResolvedValue({ existe: true, organizacionId: 3, razonSocial: "Otra SA", estado: "ACTIVA" });
    renderizar(<NuevaOrganizacion zona="admin" />);
    const cuit = screen.getByLabelText("CUIT");
    await userEvent.type(cuit, "30712345678");
    await userEvent.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya hay una organización con ese cuit: otra sa/i);
  });

  it("manda los dueños como objetos, no como ids sueltos", async () => {
    // ARCHITECTURE.md dice `personaId[]`; el backend recibe objetos.
    renderizar(<NuevaOrganizacion zona="admin" />);
    await userEvent.type(screen.getByLabelText("CUIT"), "30712345678");
    await userEvent.type(screen.getByLabelText(/razón social/i), "Kiosco SRL");

    await userEvent.click(screen.getByRole("button", { name: /agregar dueño/i }));
    await userEvent.type(await screen.findByLabelText(/dni del dueño/i), "40123456");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await userEvent.type(await screen.findByLabelText(/porcentaje/i), "100");
    await userEvent.click(screen.getByRole("button", { name: /^agregar$/i }));

    await userEvent.click(screen.getByRole("button", { name: /^registrar organización$/i }));

    await waitFor(() => expect(crearOrganizacion).toHaveBeenCalled());
    expect(crearOrganizacion.mock.calls[0][0].duenos).toEqual([
      { personaId: 5, porcentajeTitularidad: 100 },
    ]);
    expect(navegar).toHaveBeenCalledWith("/admin/organizaciones/9", { replace: true });
  });

  it("no deja agregar dos veces a la misma persona", async () => {
    renderizar(<NuevaOrganizacion zona="admin" />);
    for (let i = 0; i < 2; i += 1) {
      await userEvent.click(screen.getByRole("button", { name: /agregar dueño/i }));
      await userEvent.type(await screen.findByLabelText(/dni del dueño/i), "40123456");
      await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
      if (i === 0) {
        await userEvent.click(await screen.findByRole("button", { name: /^agregar$/i }));
      }
    }
    expect(await screen.findByText(/ya está en la lista/i)).toBeInTheDocument();
  });
});

describe("portal: mis organizaciones", () => {
  it("se arma con las representaciones, que es la consulta que existe", async () => {
    listarRepresentaciones.mockResolvedValue([
      { representacionId: 1, organizacionId: 1, razonSocial: "Kiosco del Barrio SRL",
        alcance: "TOTAL", desde: "2026-09-06", hasta: null, estado: "VIGENTE" },
    ]);
    conSesion({ id: 1, rol: "PERSONA", subType: "CIUDADANO" });
    renderizar(<MisOrganizaciones />);

    expect(await screen.findByText("Kiosco del Barrio SRL")).toBeInTheDocument();
    expect(listarRepresentaciones).toHaveBeenCalledWith(1, expect.anything());
  });

  it("explica cómo se consigue una representación cuando no hay ninguna", async () => {
    conSesion({ id: 1, rol: "PERSONA", subType: "CIUDADANO" });
    renderizar(<MisOrganizaciones />);
    expect(await screen.findByText(/no representás a ninguna organización/i)).toBeInTheDocument();
    expect(screen.getByText(/tiene que otorgarte la representación/i)).toBeInTheDocument();
  });
});
