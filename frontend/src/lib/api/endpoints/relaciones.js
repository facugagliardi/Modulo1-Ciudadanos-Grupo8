import { del, get, patch, post, put } from "../cliente";
import { cuerpo } from "../campos";

/** Trae ya el nombre y apellido del otro extremo: no hace falta un GET por familiar. */
export async function listarRelaciones(ciudadanoId, senal) {
  const res = await get(`/ciudadanos/${ciudadanoId}/relaciones`, senal);
  return res?.items ?? [];
}

/**
 * La relacion se declara desde los dos extremos: si 1 es PADRE de 2, entonces
 * relacionCiudadano2 es HIJO. Ver RECIPROCO en dominio/listasBlancas.
 */
export function crearRelacion(datos) {
  return post("/relaciones", cuerpo("crearRelacion", datos));
}

export function actualizarRelacion(relacionId, datos) {
  return put(`/relaciones/${relacionId}`, cuerpo("actualizarRelacion", datos));
}

export function cambiarResponsable(relacionId, esResponsable) {
  return patch(`/relaciones/${relacionId}/responsable`, cuerpo("cambiarResponsable", { esResponsable }));
}

export function eliminarRelacion(relacionId) {
  return del(`/relaciones/${relacionId}`);
}
