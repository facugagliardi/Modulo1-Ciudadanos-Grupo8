import { describe, expect, it } from "vitest";
import { esEmpleado, etiquetaRol, PERMISOS, PERMISOS_POR_ROL, puede } from "./permisos";

describe("matriz de permisos", () => {
  it("PERSONA no tiene ningún permiso y aun así opera sobre lo propio", () => {
    // Regla del backend: sobre lo propio no hace falta permiso. La lista vacía
    // es correcta, no un olvido.
    expect(PERMISOS_POR_ROL.PERSONA).toEqual([]);
    expect(puede("PERSONA", PERMISOS.LISTAR_PADRON)).toBe(false);
  });

  it("sólo el responsable de área puede cambiar el estado de un titular", () => {
    // Bloquear o marcar fallecido es la acción menos reversible del sistema.
    expect(puede("RESPONSABLE_AREA", PERMISOS.CAMBIAR_ESTADO_TITULAR)).toBe(true);
    for (const rol of ["ADMINISTRATIVO", "MESA_ENTRADAS", "AUDITOR", "PERSONA"]) {
      expect(puede(rol, PERMISOS.CAMBIAR_ESTADO_TITULAR)).toBe(false);
    }
  });

  it("el auditor ve todo y no escribe nada", () => {
    expect(puede("AUDITOR", PERMISOS.LEER_TERCEROS)).toBe(true);
    expect(puede("AUDITOR", PERMISOS.LISTAR_PADRON)).toBe(true);
    for (const escritura of [
      PERMISOS.EDITAR_TERCEROS,
      PERMISOS.VALIDAR_DOCUMENTACION,
      PERMISOS.GESTIONAR_EXPEDIENTES,
      PERMISOS.SOLICITAR_DOCUMENTACION,
      PERMISOS.CAMBIAR_ESTADO_EXPEDIENTE,
      PERMISOS.GESTIONAR_REPRESENTACIONES,
      PERMISOS.CAMBIAR_ESTADO_TITULAR,
    ]) {
      expect(puede("AUDITOR", escritura)).toBe(false);
    }
  });

  it("los roles de empleado forman una escalera", () => {
    // Administrativo hace todo lo de mesa de entradas, y responsable de área
    // todo lo del administrativo.
    for (const p of PERMISOS_POR_ROL.MESA_ENTRADAS) {
      expect(PERMISOS_POR_ROL.ADMINISTRATIVO).toContain(p);
    }
    for (const p of PERMISOS_POR_ROL.ADMINISTRATIVO) {
      expect(PERMISOS_POR_ROL.RESPONSABLE_AREA).toContain(p);
    }
    expect(PERMISOS_POR_ROL.RESPONSABLE_AREA.length).toBeGreaterThan(
      PERMISOS_POR_ROL.ADMINISTRATIVO.length,
    );
  });

  it("mesa de entradas no valida documentación", () => {
    expect(puede("MESA_ENTRADAS", PERMISOS.VALIDAR_DOCUMENTACION)).toBe(false);
    expect(puede("ADMINISTRATIVO", PERMISOS.VALIDAR_DOCUMENTACION)).toBe(true);
  });

  it("SERVICIO sólo consulta entre módulos", () => {
    expect(PERMISOS_POR_ROL.SERVICIO).toEqual([PERMISOS.CONSULTA_INTERMODULO]);
  });

  it("un rol desconocido no puede nada", () => {
    expect(puede("INVENTADO", PERMISOS.LEER_TERCEROS)).toBe(false);
    expect(puede(undefined, PERMISOS.LEER_TERCEROS)).toBe(false);
  });
});

describe("clasificación de roles", () => {
  it("distingue empleados de titulares", () => {
    expect(esEmpleado("MESA_ENTRADAS")).toBe(true);
    expect(esEmpleado("AUDITOR")).toBe(true);
    expect(esEmpleado("PERSONA")).toBe(false);
    expect(esEmpleado(null)).toBe(false);
  });

  it("traduce el rol para la pantalla", () => {
    expect(etiquetaRol("RESPONSABLE_AREA")).toBe("Responsable de área");
    expect(etiquetaRol("DESCONOCIDO")).toBe("DESCONOCIDO");
  });
});
