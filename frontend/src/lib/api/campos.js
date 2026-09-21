/**
 * Los campos exactos que acepta cada cuerpo del backend.
 *
 * El backend corre con `spring.jackson.deserialization.fail-on-unknown-properties: true`:
 * un campo de mas NO se ignora, hace fallar el request con 400. Y como el
 * proyecto es JavaScript, sin esto el error aparece recien en runtime.
 *
 * `soloCampos` deja pasar unicamente lo declarado. Eso vuelve estructuralmente
 * imposible la clase de bug mas probable del proyecto: reenviar a un PUT el
 * objeto que devolvio un GET.
 *
 * Las listas salen de contexto.md seccion 5, verificadas contra los `record`
 * de Java del backend.
 */

export const CAMPOS = {
  // --- auth ---
  registrarCiudadano: ["tipo", "cuit", "password", "dni", "nombre", "apellido", "fechaNacimiento"],
  registrarJuridica: ["tipo", "cuit", "password", "razonSocial", "nombreFantasia", "fechaDeCreacion"],
  login: ["cuit", "password"],
  loginEmpleado: ["mail", "password"],
  refrescar: ["refreshToken"],

  // --- ciudadanos ---
  // Ojo: no incluye `estado`. Para eso esta PATCH /ciudadanos/{id}/estado.
  actualizarCiudadano: ["nombre", "apellido", "fechaNacimiento", "dni", "cuil"],
  cambiarEstado: ["estado"],

  // --- relaciones ---
  crearRelacion: [
    "ciudadanoId1",
    "ciudadanoId2",
    "relacionCiudadano1",
    "relacionCiudadano2",
    "esResponsable",
  ],
  actualizarRelacion: ["relacionCiudadano1", "relacionCiudadano2"],
  cambiarResponsable: ["esResponsable"],

  // --- domicilios ---
  crearDomicilio: [
    "tipo",
    "calle",
    "numero",
    "altura",
    "idBarrio",
    "longitud",
    "latitud",
    "esPrincipal",
  ],
  // El PUT no acepta esPrincipal, y ademas no es parcial: tipo, calle y numero
  // son obligatorios y sobreescriben.
  actualizarDomicilio: ["tipo", "calle", "numero", "altura", "idBarrio", "longitud", "latitud"],

  // --- contactos ---
  crearContacto: ["tipo", "valor"],
  actualizarContacto: ["tipo", "valor"],
  verificarContacto: ["codigo"],

  // --- organizaciones ---
  crearOrganizacion: ["cuit", "razonSocial", "nombreFantasia", "tipo", "taxId", "duenos"],
  actualizarOrganizacion: ["razonSocial", "nombreFantasia", "tipo"],
  agregarDueno: ["personaId", "porcentajeTitularidad"],
  // El PUT sólo mueve el porcentaje: la persona ya viene en la URL.
  actualizarDueno: ["porcentajeTitularidad"],

  // --- representaciones ---
  crearRepresentacion: ["personaId", "organizacionId", "alcance", "desde", "hasta"],

  // --- expedientes ---
  crearExpediente: ["numero", "personaId", "caratula", "areaIniciadora"],
  crearActuacion: ["tipo", "descripcion", "moduloOrigen", "adjuntos"],

  // --- documentacion ---
  validarDocumento: ["aprobado", "vigenciaHasta"],
  crearSolicitud: ["titularId", "tipoDocumento", "plazo", "origen"],
  cambiarEstadoSolicitud: ["estado", "documentoId"],
};

/**
 * Deja pasar solo los campos declarados y descarta los `undefined`.
 *
 * `null` SI pasa: es significativo. En PUT /ciudadanos/{id} quiere decir "no
 * tocar este campo", y en una representacion `hasta: null` quiere decir "sin
 * vencimiento".
 */
export function soloCampos(objeto, campos) {
  if (!objeto) return {};
  return Object.fromEntries(
    Object.entries(objeto).filter(([clave, valor]) => campos.includes(clave) && valor !== undefined),
  );
}

/** Azucar: `cuerpo("crearContacto", datos)`. Falla fuerte si el nombre no existe. */
export function cuerpo(nombre, objeto) {
  const campos = CAMPOS[nombre];
  if (!campos) throw new Error(`No hay lista de campos declarada para "${nombre}"`);
  return soloCampos(objeto, campos);
}
