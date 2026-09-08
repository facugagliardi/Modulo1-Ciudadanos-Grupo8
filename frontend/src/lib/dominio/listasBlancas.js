/**
 * Valores de texto libre que el backend acepta. Cualquier otra cosa es 400.
 *
 * Espejo de:
 *   backend/src/main/java/ar/edu/uade/ciudadanos/common/ListasBlancas.java
 *
 * No hay endpoint que devuelva estas listas, asi que se replican aca. El
 * backend las guarda en un Set sin orden garantizado: el orden de abajo es
 * decision nuestra (lo mas frecuente primero, "Otro" al final) y es el que
 * ve el usuario en los desplegables.
 *
 * Cada entrada tiene el `valor` que viaja al backend y la `etiqueta` que lee
 * la persona. Es el lugar exacto donde se cumple la convencion del equipo:
 * codigo en mayusculas, pantalla en castellano.
 */

const opciones = (pares) => pares.map(([valor, etiqueta]) => ({ valor, etiqueta }));

export const TIPOS_RELACION = opciones([
  ["PADRE", "Padre"],
  ["MADRE", "Madre"],
  ["HIJO", "Hijo"],
  ["HIJA", "Hija"],
  ["CONYUGE", "Cónyuge"],
  ["CONVIVIENTE", "Conviviente"],
  ["HERMANO", "Hermano"],
  ["HERMANA", "Hermana"],
  ["TUTOR", "Tutor"],
  ["TUTELADO", "Tutelado"],
  ["APODERADO", "Apoderado"],
  ["OTRO", "Otro"],
]);

/**
 * El reciproco de un vinculo, cuando se puede deducir sin inventar nada.
 *
 * Solo estan los pares que quedan determinados por el vinculo mismo. Los que
 * dependen del genero de la otra persona NO estan a proposito: si alguien
 * declara "es mi hija", el otro extremo puede ser PADRE o MADRE, y la
 * aplicacion no tiene forma de saberlo (el backend no guarda genero).
 * Adivinarlo escribe un dato falso en el registro civil del municipio.
 *
 * Para esos casos, `reciprocoDe` devuelve null y la pantalla obliga a elegir.
 */
export const RECIPROCO = {
  CONYUGE: "CONYUGE",
  CONVIVIENTE: "CONVIVIENTE",
  TUTOR: "TUTELADO",
  TUTELADO: "TUTOR",
  OTRO: "OTRO",
};

/** El reciproco, o null si depende de un dato que no tenemos. */
export function reciprocoDe(tipo) {
  return RECIPROCO[tipo] ?? null;
}

export const TIPOS_PROPIEDAD = opciones([
  ["CASA", "Casa"],
  ["DEPARTAMENTO", "Departamento"],
  ["LOCAL", "Local"],
  ["OFICINA", "Oficina"],
  ["GALPON", "Galpón"],
  ["TERRENO", "Terreno"],
  ["OTRO", "Otro"],
]);

export const ALCANCES_REPRESENTACION = opciones([
  ["TOTAL", "Total"],
  ["TRAMITES", "Trámites"],
  ["FIRMA", "Firma"],
  ["CONSULTA", "Consulta"],
]);

export const TIPOS_DOCUMENTO = opciones([
  ["DNI", "DNI"],
  ["CUIL", "CUIL"],
  ["CUIT", "CUIT"],
  ["PASAPORTE", "Pasaporte"],
  ["PARTIDA_NACIMIENTO", "Partida de nacimiento"],
  ["CERTIFICADO_DOMICILIO", "Certificado de domicilio"],
  ["CERTIFICADO_DISCAPACIDAD", "Certificado de discapacidad"],
  ["CONSTANCIA_CUIT", "Constancia de CUIT"],
  ["ESTATUTO", "Estatuto"],
  ["PODER", "Poder"],
  ["OTRO", "Otro"],
]);

export const TIPOS_ORGANIZACION = opciones([
  ["SRL", "S.R.L."],
  ["SA", "S.A."],
  ["SAS", "S.A.S."],
  ["UNIPERSONAL", "Unipersonal"],
  ["COOPERATIVA", "Cooperativa"],
  ["ASOCIACION_CIVIL", "Asociación civil"],
  ["FUNDACION", "Fundación"],
  ["ONG", "ONG"],
  ["OTRO", "Otro"],
]);

export const TIPOS_ACTUACION = opciones([
  ["INICIO", "Inicio"],
  ["PASE", "Pase"],
  ["NOTIFICACION", "Notificación"],
  ["DICTAMEN", "Dictamen"],
  ["RESOLUCION", "Resolución"],
  ["PEDIDO_DOCUMENTACION", "Pedido de documentación"],
  ["ARCHIVO", "Archivo"],
  ["OTRO", "Otro"],
]);

export const TIPOS_CONTACTO = opciones([
  ["EMAIL", "Correo electrónico"],
  ["TELEFONO", "Teléfono"],
]);

/** Busca la etiqueta legible de un valor dentro de una lista. */
export function etiquetaDe(lista, valor) {
  return lista.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/** Archivos que el backend acepta. Se valida antes de subir para no comerse un 413. */
export const ARCHIVOS_PERMITIDOS = {
  extensiones: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
  tiposMime: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  tamanoMaximoBytes: 10 * 1024 * 1024,
};
