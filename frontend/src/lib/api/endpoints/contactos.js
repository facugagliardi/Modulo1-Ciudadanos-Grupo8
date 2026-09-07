import { del, get, patch, post, put } from "../cliente";
import { cuerpo } from "../campos";

export async function listarContactos(ciudadanoId, senal) {
  const res = await get(`/ciudadanos/${ciudadanoId}/contactos`, senal);
  return res?.items ?? [];
}

/**
 * El backend normaliza: el mail se guarda en minusculas y el telefono sin
 * espacios ni guiones. Siempre mostrar lo que devuelve la respuesta, no lo
 * que escribio la persona.
 */
export function crearContacto(ciudadanoId, datos) {
  return post(`/ciudadanos/${ciudadanoId}/contactos`, cuerpo("crearContacto", datos));
}

/** Editar un contacto lo vuelve a dejar como no verificado. */
export function actualizarContacto(contactoId, datos) {
  return put(`/contactos/${contactoId}`, cuerpo("actualizarContacto", datos));
}

export function eliminarContacto(contactoId) {
  return del(`/contactos/${contactoId}`);
}

/**
 * OJO: hoy la verificacion no verifica nada. El backend acepta cualquier
 * codigo de 6 digitos porque no hay emision ni almacenamiento de codigos.
 */
export function verificarContacto(contactoId, codigo) {
  return patch(`/contactos/${contactoId}/verificar`, cuerpo("verificarContacto", { codigo }));
}
