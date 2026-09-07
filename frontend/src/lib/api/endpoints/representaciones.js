import { get, patch, post } from "../cliente";
import { cuerpo } from "../campos";

/**
 * Representaciones: qué personas físicas pueden actuar en nombre de una
 * organización, con qué alcance y hasta cuándo.
 *
 * Es lo que consume el Módulo 4 (Habilitaciones) para autorizar trámites, así
 * que el estado importa fuera de este módulo.
 *
 * DETALLE IMPORTANTE: el `estado` que devuelven los GET es **calculado**. Si
 * `hasta` ya pasó y la fila dice VIGENTE, la API responde VENCIDA sin escribir
 * en la base. Hay que confiar en lo que devuelve, no recalcular las fechas.
 */

export async function listarRepresentacionesDeOrganizacion(organizacionId, senal) {
  const res = await get(`/organizaciones/${organizacionId}/representaciones`, senal);
  return res?.items ?? [];
}

/** 409 si ya hay una representación activa para ese par persona-organización. */
export function crearRepresentacion(datos) {
  return post("/representaciones", cuerpo("crearRepresentacion", datos));
}

export function cambiarEstadoRepresentacion(id, estado) {
  return patch(`/representaciones/${id}/estado`, cuerpo("cambiarEstado", { estado }));
}
