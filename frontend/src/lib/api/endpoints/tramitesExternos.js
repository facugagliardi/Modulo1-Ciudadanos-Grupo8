import { get } from "../cliente";

export async function listarTramitesExternos(ciudadanoId, senal) {
  const respuesta = await get(`/ciudadanos/${ciudadanoId}/tramites-externos`, senal);
  return respuesta?.items ?? [];
}
