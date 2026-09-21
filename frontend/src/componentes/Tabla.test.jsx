import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabla } from "./Tabla";
import { elegirOpcion, renderizar } from "@/pruebas/utilidades";

/**
 * La tabla carga con el peso de un requisito del enunciado: el backend
 * devuelve los listados completos sin filtrar ni paginar, así que buscar,
 * ordenar y paginar es responsabilidad del front.
 */

const VECINOS = [
  { id: 1, nombre: "Ana", apellido: "Pérez", dni: "10000001", estado: "ACTIVO" },
  { id: 2, nombre: "Bruno", apellido: "Gómez", dni: "10000002", estado: "INACTIVO" },
  { id: 3, nombre: "Carla", apellido: "Álvarez", dni: "10000003", estado: "ACTIVO" },
];

const COLUMNAS = [
  { clave: "apellido", titulo: "Apellido" },
  { clave: "nombre", titulo: "Nombre" },
  { clave: "dni", titulo: "DNI" },
];

function tabla(props = {}) {
  return renderizar(
    <Tabla
      columnas={COLUMNAS}
      filas={VECINOS}
      claveFila={(f) => f.id}
      buscarEn={["nombre", "apellido", "dni"]}
      {...props}
    />,
  );
}

function filasVisibles() {
  const cuerpo = screen.getAllByRole("rowgroup")[1];
  return within(cuerpo).getAllByRole("row");
}

describe("búsqueda", () => {
  it("filtra por el texto escrito", async () => {
    tabla();
    await userEvent.type(screen.getByLabelText("Buscar"), "bruno");
    expect(filasVisibles()).toHaveLength(1);
    expect(screen.getByText("Gómez")).toBeInTheDocument();
  });

  it("encuentra igual sin escribir los acentos", async () => {
    // Es el caso más común en castellano y el que hace inservible una
    // búsqueda ingenua.
    tabla();
    await userEvent.type(screen.getByLabelText("Buscar"), "perez");
    expect(filasVisibles()).toHaveLength(1);
    expect(screen.getByText("Pérez")).toBeInTheDocument();
  });

  it("distingue 'no hay nada' de 'tu búsqueda no encontró nada'", async () => {
    tabla();
    await userEvent.type(screen.getByLabelText("Buscar"), "zzzz");
    expect(screen.getByText(/no encontramos resultados/i)).toBeInTheDocument();
    expect(screen.queryByText(/todavía no hay nada/i)).not.toBeInTheDocument();
  });

  it("el botón de limpiar devuelve la lista completa", async () => {
    tabla();
    await userEvent.type(screen.getByLabelText("Buscar"), "zzzz");
    await userEvent.click(screen.getByRole("button", { name: /limpiar búsqueda/i }));
    expect(filasVisibles()).toHaveLength(3);
  });

  it("muestra el estado vacío cuando de verdad no hay datos", () => {
    tabla({ filas: [], vacio: { titulo: "El padrón está vacío" } });
    expect(screen.getByText("El padrón está vacío")).toBeInTheDocument();
  });
});

describe("filtros", () => {
  it("filtra por el valor elegido", async () => {
    tabla({
      filtros: [
        {
          clave: "estado",
          etiqueta: "Estado",
          opciones: [
            { valor: "ACTIVO", etiqueta: "Activo" },
            { valor: "INACTIVO", etiqueta: "Inactivo" },
          ],
        },
      ],
    });

    await elegirOpcion(screen.getByLabelText("Estado"), "INACTIVO");
    expect(filasVisibles()).toHaveLength(1);
    expect(screen.getByText("Bruno")).toBeInTheDocument();
  });
});

describe("orden", () => {
  it("ordena al hacer clic y anuncia la dirección", async () => {
    tabla();
    const encabezado = screen.getByRole("columnheader", { name: /apellido/i });

    await userEvent.click(within(encabezado).getByRole("button"));
    expect(encabezado).toHaveAttribute("aria-sort", "ascending");
    expect(within(filasVisibles()[0]).getByText("Álvarez")).toBeInTheDocument();

    await userEvent.click(within(encabezado).getByRole("button"));
    expect(encabezado).toHaveAttribute("aria-sort", "descending");
    expect(within(filasVisibles()[0]).getByText("Pérez")).toBeInTheDocument();

    // Tercer clic: vuelve al orden original.
    await userEvent.click(within(encabezado).getByRole("button"));
    expect(encabezado).toHaveAttribute("aria-sort", "none");
    expect(within(filasVisibles()[0]).getByText("Pérez")).toBeInTheDocument();
  });
});

describe("paginación", () => {
  const muchos = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    nombre: `Vecino ${i + 1}`,
    apellido: `Apellido ${i + 1}`,
    dni: String(20000000 + i),
  }));

  it("corta en la cantidad elegida y avanza de página", async () => {
    tabla({ filas: muchos, filasPorPaginaInicial: 25 });

    expect(filasVisibles()).toHaveLength(25);
    expect(screen.getByText(/mostrando 1–25 de 60/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(screen.getByText(/mostrando 26–50 de 60/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(filasVisibles()).toHaveLength(10);
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeDisabled();
  });

  it("vuelve a la primera página al buscar", async () => {
    tabla({ filas: muchos });
    await userEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    await userEvent.type(screen.getByLabelText("Buscar"), "Vecino 1");
    expect(screen.getByText(/mostrando 1–/i)).toBeInTheDocument();
  });
});

describe("estados de carga y error", () => {
  it("muestra filas fantasma mientras carga", () => {
    tabla({ cargando: true });
    expect(screen.queryByText("Pérez")).not.toBeInTheDocument();
    expect(filasVisibles().length).toBeGreaterThan(0);
  });

  it("muestra el error con opción de reintentar", async () => {
    let reintentos = 0;
    tabla({
      filas: [],
      error: { status: 500, message: "Error interno" },
      alReintentar: () => {
        reintentos += 1;
      },
    });
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(reintentos).toBe(1);
  });
});

describe("accesibilidad", () => {
  it("la primera celda es un enlace real, alcanzable con el teclado", () => {
    tabla({ enlaceFila: (f) => `/admin/padron/${f.id}` });
    const enlace = screen.getByRole("link", { name: "Pérez" });
    expect(enlace).toHaveAttribute("href", "/admin/padron/1");
  });
});
