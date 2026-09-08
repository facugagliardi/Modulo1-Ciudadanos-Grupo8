/**
 * Buscar "perez" tiene que encontrar a "Pérez", y buscar "Peña" no tiene que
 * fallar porque el usuario escribió "pena". Sin normalizar, la búsqueda del
 * padrón es inservible en castellano.
 */

// Marcas de acento que NFD deja sueltas, escritas con escapes para que el
// archivo no dependa de cómo lo guarde el editor.
const ACENTOS = /[̀-ͯ]/g;

export function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase()
    .trim();
}

/** Compara para ordenar: números como números, texto con reglas del castellano. */
export function comparar(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return 1; // los vacíos al final
  if (b === null || b === undefined || b === "") return -1;

  const numA = typeof a === "number" ? a : Number(String(a).replace(/[^\d.-]/g, ""));
  const numB = typeof b === "number" ? b : Number(String(b).replace(/[^\d.-]/g, ""));
  const ambosNumericos =
    !Number.isNaN(numA) &&
    !Number.isNaN(numB) &&
    String(a).trim() !== "" &&
    String(b).trim() !== "";
  if (ambosNumericos && numA !== numB) return numA - numB;

  return String(a).localeCompare(String(b), "es", { sensitivity: "base", numeric: true });
}
