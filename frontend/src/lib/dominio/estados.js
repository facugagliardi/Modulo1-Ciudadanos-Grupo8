/**
 * Los estados del dominio y el grafo de transiciones.
 *
 * Espejo de:
 *   backend/src/main/java/ar/edu/uade/ciudadanos/common/TransicionesEstado.java
 *
 * Si alguien toca ese archivo, este queda desincronizado. Es la unica copia
 * que vale la pena mantener a mano: sirve para que el usuario nunca vea un 400
 * por transicion invalida, porque los destinos imposibles no se ofrecen.
 *
 * Dos reglas del backend que este modulo hace visibles:
 *   - Un destino fuera de la lista es 400.
 *   - Mandar el estado que ya se tiene TAMBIEN es 400 (no es idempotente).
 *     Por eso `destinosPosibles` nunca incluye el estado actual.
 */

export const ENTIDADES = {
  CIUDADANO: "CIUDADANO",
  ORGANIZACION: "ORGANIZACION",
  REPRESENTACION: "REPRESENTACION",
  SOLICITUD: "SOLICITUD",
  EXPEDIENTE: "EXPEDIENTE",
};

export const TRANSICIONES = {
  CIUDADANO: {
    ACTIVO: ["INACTIVO", "BLOQUEADO", "FALLECIDO"],
    INACTIVO: ["ACTIVO", "BLOQUEADO", "FALLECIDO"],
    BLOQUEADO: ["ACTIVO", "INACTIVO", "FALLECIDO"],
    FALLECIDO: [],
  },
  ORGANIZACION: {
    ACTIVA: ["INACTIVA", "BLOQUEADA"],
    INACTIVA: ["ACTIVA", "BLOQUEADA"],
    BLOQUEADA: ["ACTIVA", "INACTIVA"],
  },
  REPRESENTACION: {
    VIGENTE: ["VENCIDA", "REVOCADA"],
    VENCIDA: [],
    REVOCADA: [],
  },
  SOLICITUD: {
    // VENCIDA -> CUMPLIDA existe a proposito: se puede cumplir fuera de plazo.
    PENDIENTE: ["CUMPLIDA", "VENCIDA"],
    VENCIDA: ["CUMPLIDA"],
    CUMPLIDA: [],
  },
  EXPEDIENTE: {
    INICIADO: ["EN_TRAMITE", "ARCHIVADO"],
    EN_TRAMITE: ["RESUELTO", "ARCHIVADO"],
    RESUELTO: ["ARCHIVADO"],
    ARCHIVADO: [],
  },
};

/** Estados a los que se puede pasar desde `actual`. Lista vacia = terminal. */
export function destinosPosibles(entidad, actual) {
  return TRANSICIONES[entidad]?.[actual] ?? [];
}

/**
 * Terminal = del grafo no sale ninguna arista. Se deriva, no se declara:
 * asi `VENCIDA` sale terminal en REPRESENTACION y no terminal en SOLICITUD,
 * que es exactamente lo que hace el backend.
 */
export function esTerminal(entidad, estado) {
  return destinosPosibles(entidad, estado).length === 0;
}

/**
 * Valencia: que tan grave es el estado. Decide el COLOR del badge.
 * La terminalidad va aparte, en un glifo, para no informar solo por color.
 */
export const VALENCIA = {
  // Todo en orden
  ACTIVO: "positiva",
  ACTIVA: "positiva",
  VIGENTE: "positiva",
  CUMPLIDA: "positiva",
  VALIDADO: "positiva",
  RESUELTO: "positiva",
  // Pide una accion
  PENDIENTE: "pendiente",
  INACTIVO: "pendiente",
  INACTIVA: "pendiente",
  // Adverso
  FALLECIDO: "grave",
  BLOQUEADO: "grave",
  BLOQUEADA: "grave",
  REVOCADA: "grave",
  RECHAZADO: "grave",
  VENCIDA: "grave",
  // En curso o cerrado sin carga
  INICIADO: "neutra",
  EN_TRAMITE: "neutra",
  ARCHIVADO: "neutra",
};

export function valenciaDe(estado) {
  return VALENCIA[estado] ?? "neutra";
}

/**
 * Etiquetas para el vecino. La convencion del equipo es clara: el codigo en
 * mayusculas es del sistema, lo que se lee en pantalla es castellano normal.
 */
export const ETIQUETA_ESTADO = {
  ACTIVO: "Activo",
  ACTIVA: "Activa",
  INACTIVO: "Inactivo",
  INACTIVA: "Inactiva",
  BLOQUEADO: "Bloqueado",
  BLOQUEADA: "Bloqueada",
  FALLECIDO: "Fallecido",
  VIGENTE: "Vigente",
  VENCIDA: "Vencida",
  REVOCADA: "Revocada",
  PENDIENTE: "Pendiente",
  CUMPLIDA: "Cumplida",
  INICIADO: "Iniciado",
  EN_TRAMITE: "En trámite",
  RESUELTO: "Resuelto",
  ARCHIVADO: "Archivado",
  VALIDADO: "Validado",
  RECHAZADO: "Rechazado",
};

export function etiquetaEstado(estado) {
  return ETIQUETA_ESTADO[estado] ?? estado;
}
