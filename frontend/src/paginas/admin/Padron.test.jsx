import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Padron } from "./Padron";
import { conSesion, elegirOpcion, renderizar } from "@/pruebas/utilidades";
import { ErrorApi } from "@/lib/api/cliente";

const listarCiudadanos = vi.fn();
vi.mock("@/lib/api/endpoints/ciudadanos", () => ({
  listarCiudadanos: (...a) => listarCiudadanos(...a),
}));

const VECINOS = [
  {
    id: 3,
    dni: "34567890",
    nombre: "Diego",
    apellido: "Lopez",
    fechaNacimiento: "1989-04-12",
    cuil: "20345678901",
    estado: "ACTIVO",
  },
  {
    id: 4,
    dni: "28111222",
    nombre: "Ana",
    apellido: "Pérez",
    fechaNacimiento: "1980-01-05",
    cuil: "27281112223",
    estado: "FALLECIDO",
  },
];

beforeEach(() => {
  listarCiudadanos.mockReset();
  listarCiudadanos.mockResolvedValue(VECINOS);
});

describe("padrón", () => {
  it("muestra los vecinos con el DNI y el CUIL formateados", async () => {
    conSesion({ rol: "RESPONSABLE_AREA" });
    renderizar(<Padron />);

    expect(await screen.findByText("Diego Lopez")).toBeInTheDocument();
    // El backend devuelve los identificadores sin separadores; los pone el front.
    expect(screen.getByText("34.567.890")).toBeInTheDocument();
    expect(screen.getByText("20-34567890-1")).toBeInTheDocument();
  });

  it("marca los estados terminales para que se note que no vuelven atrás", async () => {
    conSesion();
    renderizar(<Padron />);

    const fallecido = await screen.findByText("Fallecido");
    expect(fallecido).toBeInTheDocument();
    expect(
      screen.getByText(/estado final, no se puede revertir/i),
    ).toBeInTheDocument();
  });

  it("filtra por estado sin volver a pedirle nada al backend", async () => {
    // El listado viene completo en una sola llamada: filtrar es del front.
    conSesion();
    renderizar(<Padron />);
    await screen.findByText("Diego Lopez");

    await elegirOpcion(screen.getByLabelText("Estado"), "FALLECIDO");

    expect(screen.queryByText("Diego Lopez")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(listarCiudadanos).toHaveBeenCalledTimes(1);
  });

  it("busca por apellido sin acentos", async () => {
    conSesion();
    renderizar(<Padron />);
    await screen.findByText("Ana Pérez");

    await userEvent.type(screen.getByLabelText(/buscar por nombre/i), "perez");
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.queryByText("Diego Lopez")).not.toBeInTheDocument();
  });

  it("enlaza cada fila al legajo", async () => {
    conSesion();
    renderizar(<Padron />);
    const enlace = await screen.findByRole("link", { name: "Diego Lopez" });
    expect(enlace).toHaveAttribute("href", "/admin/padron/3");
  });
});

describe("acciones según el rol", () => {
  it("un responsable de área puede registrar un vecino", async () => {
    conSesion({ rol: "RESPONSABLE_AREA" });
    renderizar(<Padron />);
    expect(await screen.findByRole("link", { name: /registrar vecino/i })).toBeInTheDocument();
  });

  it("el auditor ve el padrón pero no la acción de alta", async () => {
    // El auditor tiene LISTAR_PADRON pero no EDITAR_TERCEROS: ofrecerle el
    // botón sería mandarlo a un 403.
    conSesion({ rol: "AUDITOR" });
    renderizar(<Padron />);

    await screen.findByText("Diego Lopez");
    expect(screen.queryByRole("link", { name: /registrar vecino/i })).not.toBeInTheDocument();
  });
});

describe("estados de la pantalla", () => {
  it("avisa cuando el padrón está vacío", async () => {
    listarCiudadanos.mockResolvedValue([]);
    conSesion();
    renderizar(<Padron />);
    expect(await screen.findByText(/el padrón está vacío/i)).toBeInTheDocument();
  });

  it("muestra el error del backend y permite reintentar", async () => {
    listarCiudadanos.mockRejectedValueOnce(
      new ErrorApi({ status: 500, message: "Error interno" }),
    );
    conSesion();
    renderizar(<Padron />);

    const reintentar = await screen.findByRole("button", { name: /reintentar/i });
    listarCiudadanos.mockResolvedValue(VECINOS);
    await userEvent.click(reintentar);

    await waitFor(() => expect(screen.getByText("Diego Lopez")).toBeInTheDocument());
  });
});
