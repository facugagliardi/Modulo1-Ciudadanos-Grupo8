import { get, getBlob, patch, pedir, post } from "../cliente";
import { cuerpo } from "../campos";
import { ARCHIVOS_PERMITIDOS } from "../../dominio/listasBlancas";

// --- Documentos -------------------------------------------------------------

/**
 * Sube un documento. Es multipart: el campo del archivo se llama `archivo` y el
 * tipo va aparte. No se fija Content-Type a mano — lo pone el navegador con su
 * boundary, y fijarlo rompe la subida.
 */
export function subirDocumento(personaId, { archivo, tipoDocumento }) {
  const form = new FormData();
  form.append("archivo", archivo);
  form.append("tipoDocumento", tipoDocumento);
  return pedir(`/personas/${personaId}/documentos`, { metodo: "POST", form });
}

/** Nueva versión de un documento existente. El único campo es el archivo. */
export function subirVersion(documentoId, archivo) {
  const form = new FormData();
  form.append("archivo", archivo);
  return pedir(`/documentos/${documentoId}/version`, { metodo: "POST", form });
}

export function obtenerDocumento(id, senal) {
  return get(`/documentos/${id}`, senal);
}

/**
 * El archivo en sí, como Blob.
 *
 * El `Content-Type` viaja en el Blob, así que quien lo muestra puede decidir
 * con `blob.type` si es un PDF o una imagen sin tener que adivinar por el
 * nombre.
 */
export function obtenerArchivoDocumento(id, senal) {
  return getBlob(`/documentos/${id}/archivo`, senal);
}

export function validarDocumento(id, { aprobado, vigenciaHasta }) {
  return patch(`/documentos/${id}/validar`, cuerpo("validarDocumento", { aprobado, vigenciaHasta }));
}

/**
 * Valida el archivo antes de mandarlo. El backend rechaza con 400 o 413, pero
 * para eso hay que esperar toda la subida: es mejor avisar al instante.
 * Devuelve el mensaje de error, o null si está bien.
 */
export function revisarArchivo(archivo) {
  if (!archivo) return "Elegí un archivo.";
  if (archivo.size === 0) return "El archivo está vacío.";
  if (archivo.size > ARCHIVOS_PERMITIDOS.tamanoMaximoBytes) {
    return "El archivo no puede superar los 10 MB.";
  }
  const punto = archivo.name.lastIndexOf(".");
  const extension = punto === -1 ? "" : archivo.name.slice(punto).toLowerCase();
  if (!ARCHIVOS_PERMITIDOS.extensiones.includes(extension)) {
    return `Sólo se aceptan archivos ${ARCHIVOS_PERMITIDOS.extensiones.join(", ")}.`;
  }
  return null;
}

// --- Solicitudes de documentación -------------------------------------------

/**
 * Con LISTAR_PADRON vienen todas; sin el permiso, sólo las del propio titular.
 * No hay error: simplemente se ve menos.
 */
export async function listarSolicitudes(senal) {
  const res = await get("/solicitudes-documentacion", senal);
  return res?.items ?? [];
}

export function obtenerSolicitud(id, senal) {
  return get(`/solicitudes-documentacion/${id}`, senal);
}

export function crearSolicitud(datos) {
  return post("/solicitudes-documentacion", cuerpo("crearSolicitud", datos));
}

/** Pasar a CUMPLIDA exige el documentoId, y el documento tiene que ser del titular. */
export function cambiarEstadoSolicitud(id, { estado, documentoId }) {
  return patch(
    `/solicitudes-documentacion/${id}/estado`,
    cuerpo("cambiarEstadoSolicitud", { estado, documentoId }),
  );
}
