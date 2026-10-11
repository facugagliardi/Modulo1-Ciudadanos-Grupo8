import { del, get, patch, post, put } from "../cliente";
import { cuerpo } from "../campos";

/**
 * El padron completo. El backend NO filtra ni pagina: devuelve todo y el
 * filtrado es responsabilidad nuestra (ver componentes/Tabla.jsx).
 * Requiere el permiso LISTAR_PADRON.
 */
export async function listarCiudadanos(senal) {
  const res = await get("/ciudadanos", senal);
  return res?.items ?? [];
}

/** Detalle: trae ademas el domicilio principal y los contactos embebidos. */
export function obtenerCiudadano(id, senal) {
  return get(`/ciudadanos/${id}`, senal);
}

/** Parcial: los campos que no se mandan quedan como estaban. */
export function actualizarCiudadano(id, datos) {
  return put(`/ciudadanos/${id}`, cuerpo("actualizarCiudadano", datos));
}

/** Solo RESPONSABLE_AREA. La transicion tiene que ser valida (ver dominio/estados). */
export function cambiarEstadoCiudadano(id, estado) {
  return patch(`/ciudadanos/${id}/estado`, cuerpo("cambiarEstado", { estado }));
}

/**
 * Existencia por DNI. Nunca devuelve 404: responde {existe:false}.
 * Sirve para avisar "ya hay un vecino con ese DNI" antes de mandar el alta.
 */
export function buscarPorDni(dni, senal) {
  return get(`/ciudadanos/dni/${dni}`, senal);
}

// --- Domicilios -------------------------------------------------------------

/** Incluye los historicos, ordenados por vigenteDesde descendente. */
export async function listarDomicilios(ciudadanoId, senal) {
  const res = await get(`/ciudadanos/${ciudadanoId}/domicilios`, senal);
  return res?.items ?? [];
}

export function crearDomicilio(ciudadanoId, datos) {
  return post(`/ciudadanos/${ciudadanoId}/domicilios`, cuerpo("crearDomicilio", datos));
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

export async function listarDocumentos(ciudadanoId, senal) {
  const res = await get(`/ciudadanos/${ciudadanoId}/documentos`, senal);
  return res?.items ?? [];
}

// --- Representaciones -------------------------------------------------------

/** Las organizaciones que este ciudadano representa. */
export async function listarRepresentaciones(ciudadanoId, senal) {
  try {
    const res = await get(`/ciudadanos/${ciudadanoId}/representaciones`, senal);
    return res?.items ?? [];
  } catch (err) {
    if (err?.status === 404) {
      const res = await get(`/personas/${ciudadanoId}/representaciones`, senal);
      return res?.items ?? [];
    }
    throw err;
  }
}
