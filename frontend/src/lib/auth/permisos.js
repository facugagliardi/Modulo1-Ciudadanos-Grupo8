/**
 * Que puede hacer cada rol.
 *
 * Espejo de:
 *   backend/src/main/java/ar/edu/uade/ciudadanos/security/Rol.java
 *
 * ESTO NO ES SEGURIDAD. El backend valida igual y devuelve 403; esconder un
 * boton no protege nada. Sirve para no ofrecerle a alguien una accion que le
 * va a fallar, que es un requisito explicito del enunciado ("mostrar las
 * operaciones disponibles segun el rol autenticado").
 *
 * Las dos reglas del backend:
 *   1. Sobre lo propio no hace falta ningun permiso. Por eso PERSONA tiene la
 *      lista vacia y aun asi puede operar con sus datos.
 *   2. Sobre lo ajeno hace falta el permiso que corresponda.
 */

export const PERMISOS = {
  LEER_TERCEROS: "LEER_TERCEROS",
  LISTAR_PADRON: "LISTAR_PADRON",
  EDITAR_TERCEROS: "EDITAR_TERCEROS",
  CAMBIAR_ESTADO_TITULAR: "CAMBIAR_ESTADO_TITULAR",
  VALIDAR_DOCUMENTACION: "VALIDAR_DOCUMENTACION",
  SOLICITAR_DOCUMENTACION: "SOLICITAR_DOCUMENTACION",
  GESTIONAR_EXPEDIENTES: "GESTIONAR_EXPEDIENTES",
  CAMBIAR_ESTADO_EXPEDIENTE: "CAMBIAR_ESTADO_EXPEDIENTE",
  GESTIONAR_REPRESENTACIONES: "GESTIONAR_REPRESENTACIONES",
  CONSULTA_INTERMODULO: "CONSULTA_INTERMODULO",
};

const MESA = [
  PERMISOS.LEER_TERCEROS,
  PERMISOS.LISTAR_PADRON,
  PERMISOS.EDITAR_TERCEROS,
  PERMISOS.SOLICITAR_DOCUMENTACION,
  PERMISOS.GESTIONAR_EXPEDIENTES,
  PERMISOS.CONSULTA_INTERMODULO,
];

// Los tres roles de empleado del medio son una escalera: mesa de entradas
// carga, administrativo ademas resuelve, responsable de area ademas decide.
const ADMINISTRATIVO = [
  ...MESA,
  PERMISOS.VALIDAR_DOCUMENTACION,
  PERMISOS.CAMBIAR_ESTADO_EXPEDIENTE,
  PERMISOS.GESTIONAR_REPRESENTACIONES,
];

export const PERMISOS_POR_ROL = {
  PERSONA: [],
  MESA_ENTRADAS: MESA,
  ADMINISTRATIVO,
  // Bloquear o marcar fallecido a alguien es la accion menos reversible del
  // sistema, y queda solo en el escalon mas alto.
  RESPONSABLE_AREA: [...ADMINISTRATIVO, PERMISOS.CAMBIAR_ESTADO_TITULAR],
  // El auditor ve todo y no escribe nada. Queda fuera de la escalera a proposito.
  AUDITOR: [PERMISOS.LEER_TERCEROS, PERMISOS.LISTAR_PADRON, PERMISOS.CONSULTA_INTERMODULO],
  SERVICIO: [PERMISOS.CONSULTA_INTERMODULO],
};

export const ROLES_EMPLEADO = [
  "MESA_ENTRADAS",
  "ADMINISTRATIVO",
  "RESPONSABLE_AREA",
  "AUDITOR",
];

export function puede(rol, permiso) {
  return (PERMISOS_POR_ROL[rol] ?? []).includes(permiso);
}

export function esEmpleado(rol) {
  return ROLES_EMPLEADO.includes(rol);
}

/** Nombre del rol tal como se muestra en pantalla. */
export const ETIQUETA_ROL = {
  PERSONA: "Titular",
  MESA_ENTRADAS: "Mesa de entradas",
  ADMINISTRATIVO: "Administrativo",
  RESPONSABLE_AREA: "Responsable de área",
  AUDITOR: "Auditor",
  SERVICIO: "Servicio",
};

export function etiquetaRol(rol) {
  return ETIQUETA_ROL[rol] ?? rol;
}
