import { describe, expect, it } from "vitest";
import { CAMPOS, cuerpo, soloCampos } from "./campos";

/**
 * Estas pruebas cuidan lo que el backend castiga con un 400:
 * `fail-on-unknown-properties` está activo, así que un campo de más rompe el
 * request. Como el proyecto es JavaScript, este filtro es la única red.
 */
describe("soloCampos", () => {
  it("deja pasar únicamente los campos declarados", () => {
    const res = soloCampos({ tipo: "EMAIL", valor: "a@b.com", verificado: true }, [
      "tipo",
      "valor",
    ]);
    expect(res).toEqual({ tipo: "EMAIL", valor: "a@b.com" });
  });

  it("descarta undefined pero conserva null, que es significativo", () => {
    // En PUT /ciudadanos/{id} null quiere decir "no tocar"; en una
    // representación, `hasta: null` quiere decir "sin vencimiento".
    const res = soloCampos({ nombre: undefined, apellido: null }, ["nombre", "apellido"]);
    expect(res).toEqual({ apellido: null });
    expect(res).not.toHaveProperty("nombre");
  });

  it("tolera un objeto vacío o nulo", () => {
    expect(soloCampos(null, ["a"])).toEqual({});
    expect(soloCampos({}, ["a"])).toEqual({});
  });

  it("evita el bug de reenviar a un PUT lo que devolvió un GET", () => {
    const delGet = {
      id: 3,
      nombre: "Diego",
      apellido: "Lopez",
      fechaNacimiento: "1989-04-12",
      dni: "34567890",
      cuil: "20345678901",
      estado: "ACTIVO",
      domicilioPrincipal: { propiedadId: 1 },
      contactos: [],
    };
    const aEnviar = cuerpo("actualizarCiudadano", delGet);

    expect(Object.keys(aEnviar).sort()).toEqual(
      ["apellido", "cuil", "dni", "fechaNacimiento", "nombre"].sort(),
    );
    expect(aEnviar).not.toHaveProperty("estado");
    expect(aEnviar).not.toHaveProperty("id");
    expect(aEnviar).not.toHaveProperty("contactos");
  });
});

describe("cuerpo", () => {
  it("falla fuerte si el nombre del DTO no existe", () => {
    expect(() => cuerpo("noExiste", {})).toThrow(/no hay lista de campos/i);
  });

  it("el DTO de actualizar ciudadano no incluye estado", () => {
    // El estado se cambia sólo por PATCH /ciudadanos/{id}/estado, que además
    // exige el permiso CAMBIAR_ESTADO_TITULAR.
    expect(CAMPOS.actualizarCiudadano).not.toContain("estado");
  });

  it("el DTO de actualizar domicilio no incluye esPrincipal", () => {
    expect(CAMPOS.crearDomicilio).toContain("esPrincipal");
    expect(CAMPOS.actualizarDomicilio).not.toContain("esPrincipal");
  });
});
