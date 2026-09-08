import { del, get, patch, post, put } from "../cliente";
import { cuerpo } from "../campos";

/**
 * Rutas montadas sobre /personas/{id}: sirven tanto para un ciudadano como
 * para una persona juridica. Es la unica familia de endpoints que una juridica
 * puede usar sobre si misma (no existe GET /personas-juridicas/{id}).
 */

// --- Domicilios -------------------------------------------------------------

/** Incluye los historicos, ordenados por vigenteDesde descendente. */
export async function listarDomicilios(personaId, senal) {
  const res = await get(`/personas/${personaId}/domicilios`, senal);
  return res?.items ?? [];
}

export function crearDomicilio(personaId, datos) {
  return post(`/personas/${personaId}/domicilios`, cuerpo("crearDomicilio", datos));
}

/** OJO: no es parcial. tipo, calle y numero son obligatorios y sobreescriben. */
export function actualizarDomicilio(domicilioId, datos) {
  return put(`/domicilios/${domicilioId}`, cuerpo("actualizarDomicilio", datos));
}

/** Sin cuerpo. Mandar campos da 400. */
export function marcarDomicilioPrincipal(domicilioId) {
  return patch(`/domicilios/${domicilioId}/principal`);
}

/**
 * No borra: cierra la vigencia. Devuelve 200 con cuerpo, no 204.
 * Da 409 si es el unico domicilio principal vigente.
 */
export function cerrarDomicilio(domicilioId) {
  return del(`/domicilios/${domicilioId}`);
}

// --- Documentos -------------------------------------------------------------

export async function listarDocumentos(personaId, senal) {
  const res = await get(`/personas/${personaId}/documentos`, senal);
  return res?.items ?? [];
}

// --- Representaciones -------------------------------------------------------

/** Las organizaciones que esta persona representa. */
export async function listarRepresentaciones(personaId, senal) {
  const res = await get(`/personas/${personaId}/representaciones`, senal);
  return res?.items ?? [];
}
