import { del, get, patch, post, put } from "../cliente";
import { cuerpo } from "../campos";
import { soloDigitos } from "../../dominio/formato";

/**
 * Organizaciones: empresas, comercios, asociaciones y cooperativas.
 *
 * Ojo con dos cosas que el backend no perdona:
 *   - `POST /organizaciones` recibe `duenos: [{personaId, porcentajeTitularidad}]`,
 *     NO un array de ids (ARCHITECTURE.md dice mal esto).
 *   - No se puede cambiar el CUIT: el PUT sólo acepta tres campos.
 */

export async function listarOrganizaciones(senal) {
  const res = await get("/organizaciones", senal);
  return res?.items ?? [];
}

/**
 * Las organizaciones donde la persona es dueña.
 *
 * No es lo mismo que `listarRepresentaciones`: el alta de una organización
 * anota al creador como **dueño**, no como representante. Sin esta consulta,
 * una organización recién registrada no aparecía en ningún lado del portal.
 *
 * Cada item trae además el `porcentajeTitularidad` de esa persona.
 */
export async function listarOrganizacionesDeDueno(personaId, senal) {
  const res = await get(`/personas/${personaId}/organizaciones`, senal);
  return res?.items ?? [];
}

/** Trae dueños, representantes vigentes y domicilio principal en un solo pedido. */
export function obtenerOrganizacion(id, senal) {
  return get(`/organizaciones/${id}`, senal);
}

export function crearOrganizacion(datos) {
  return post(
    "/organizaciones",
    cuerpo("crearOrganizacion", { ...datos, cuit: soloDigitos(datos.cuit) }),
  );
}

/** Parcial. El CUIT no está entre los campos aceptados a propósito. */
export function actualizarOrganizacion(id, datos) {
  return put(`/organizaciones/${id}`, cuerpo("actualizarOrganizacion", datos));
}

export function cambiarEstadoOrganizacion(id, estado) {
  return patch(`/organizaciones/${id}/estado`, cuerpo("cambiarEstado", { estado }));
}

/** Nunca devuelve 404: responde {existe:false}. */
export function buscarPorCuit(cuit, senal) {
  return get(`/organizaciones/cuit/${soloDigitos(cuit)}`, senal);
}

// --- Dueños ------------------------------------------------------------------

export async function listarDuenos(organizacionId, senal) {
  const res = await get(`/organizaciones/${organizacionId}/duenos`, senal);
  return res?.items ?? [];
}

/** 409 si ya es dueño, o si la suma de titularidades supera 100. */
export function agregarDueno(organizacionId, datos) {
  return post(`/organizaciones/${organizacionId}/duenos`, cuerpo("agregarDueno", datos));
}

/**
 * Cambia el porcentaje de un dueño que ya está en la organización.
 *
 * Es la pieza que hace posible transferir titularidad: para que entre un dueño
 * nuevo con 20%, alguien tiene que ceder esos 20 puntos primero. El backend
 * valida 0,01–100 y rechaza con 409 si la suma pasa de 100.
 */
export function actualizarDueno(organizacionId, personaId, porcentajeTitularidad) {
  return put(
    `/organizaciones/${organizacionId}/duenos/${personaId}`,
    cuerpo("actualizarDueno", { porcentajeTitularidad }),
  );
}

/** 409 si es el único dueño: una organización no puede quedarse sin ninguno. */
export function quitarDueno(organizacionId, personaId) {
  return del(`/organizaciones/${organizacionId}/duenos/${personaId}`);
}
