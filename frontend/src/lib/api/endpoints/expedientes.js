import { get, patch, post } from "../cliente";
import { cuerpo } from "../campos";

/**
 * La visibilidad cambia con el rol: con LEER_TERCEROS vienen todos, sin el
 * permiso vienen solo aquellos donde el usuario es el titular. No hay error,
 * simplemente se ve menos.
 */
export async function listarExpedientes(senal) {
  const res = await get("/expedientes", senal);
  return res?.items ?? [];
}

export function obtenerExpediente(id, senal) {
  return get(`/expedientes/${id}`, senal);
}

/** Si se omite `numero`, el backend genera EXP-{año}-{6 digitos}. */
export function crearExpediente(datos) {
  return post("/expedientes", cuerpo("crearExpediente", datos));
}

export function cambiarEstadoExpediente(id, estado) {
  return patch(`/expedientes/${id}/estado`, cuerpo("cambiarEstado", { estado }));
}

/** actuacionId es un contador POR expediente: la clave real es (expedienteId, actuacionId). */
export async function listarActuaciones(expedienteId, senal) {
  const res = await get(`/expedientes/${expedienteId}/actuaciones`, senal);
  return res?.items ?? [];
}

/** Da 409 si el expediente esta ARCHIVADO. */
export function crearActuacion(expedienteId, datos) {
  return post(`/expedientes/${expedienteId}/actuaciones`, cuerpo("crearActuacion", datos));
}
