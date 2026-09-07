import { get, patch, put } from "../cliente";
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
