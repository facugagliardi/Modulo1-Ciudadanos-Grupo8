/**
 * Los fantasmas del salto largo del backoffice: cómo se ve cada sección cuando
 * la tira pasa por delante de ella (ver `deslizarSeccion.js`). Son los del
 * portal (`fantasmasPortal.js`) con la forma de las pantallas de acá: el tablero
 * con su cifra y sus indicadores, los listados con su buscador y su tabla.
 *
 * Mismas reglas: HTML en texto y no React, barras grises y no datos de nadie,
 * todo el texto fijo y de este archivo. Las clases `.cfa-*` están en
 * `transiciones.css`.
 */

/* ---- Las piezas ----------------------------------------------------------- */

const linea = (ancho, clase = "") => `<span class="cfa-linea ${clase}" style="width:${ancho}%"></span>`;

/** El `Encabezado` de una pantalla, con su botón de alta si lo tiene. */
const encabezado = (seccion, titulo, bajada, conBoton = true) =>
  `<div class="cfa-cabecera"><div class="cfa-encabezado"><p class="cfa-seccion">${seccion}</p><p class="cfa-titulo">${titulo}</p><p class="cfa-bajada">${bajada}</p></div>${
    conBoton ? '<span class="cfa-boton"></span>' : ""
  }</div>`;

/** El buscador y los filtros de la `Tabla`. */
const controles = (filtros) =>
  `<div class="cfa-controles"><span class="cfa-campo cfa-campo--ancho"></span>${'<span class="cfa-campo"></span>'.repeat(
    filtros,
  )}</div>`;

/** Los anchos de las celdas de cada columna, en porcentaje: uno por fila, en ronda. */
const ANCHOS = [
  [62, 48, 70, 55],
  [70, 60, 50, 66],
  [44, 58, 40, 52],
];

/** La tabla: encabezados y `n` filas, con un chip de estado en la última columna. */
const tabla = (n) =>
  `<div class="cfa-tabla"><div class="cfa-fila cfa-fila--cab">${[34, 26, 30, 24]
    .map((a) => `<span>${linea(a, "cfa-linea--fuerte")}</span>`)
    .join("")}</div>${Array.from(
    { length: n },
    (_, i) =>
      `<div class="cfa-fila">${ANCHOS.map((col) => `<span>${linea(col[i % 4])}</span>`).join("")}<span><span class="cfa-chip"></span></span></div>`,
  ).join("")}</div>`;

const listado = (seccion, titulo, bajada, filtros = 1, conBoton = true) =>
  hoja(encabezado(seccion, titulo, bajada, conBoton), controles(filtros), tabla(8));

/** Un indicador del tablero: rótulo, cifra y detalle. */
const indicador = () =>
  `<div class="cfa-tarjeta cfa-tarjeta__cuerpo">${linea(60)}${linea(22, "cfa-linea--cifra")}${linea(80)}</div>`;

const hoja = (...hijos) => `<div class="cfa-hoja cfa-hoja--ancha">${hijos.join("")}</div>`;

/* ---- Las secciones -------------------------------------------------------- */

const FANTASMAS = {
  "/admin": hoja(
    encabezado(
      "Gestión interna",
      "Tablero",
      "El estado del registro municipal y lo que está esperando una decisión.",
      false,
    ),
    `<div class="cfa-par">${linea(12)}${linea(14, "cfa-linea--cifra")}${linea(36)}</div>`,
    linea(16, "cfa-linea--fuerte"),
    `<div class="cfa-indicadores">${indicador().repeat(3)}</div>`,
    linea(14, "cfa-linea--fuerte"),
    `<div class="cfa-indicadores">${indicador().repeat(3)}</div>`,
  ),
  "/admin/padron": listado(
    "Registro civil",
    "Padrón de vecinos",
    "Todas las personas físicas registradas en el municipio.",
  ),
  "/admin/organizaciones": listado(
    "Gestión interna",
    "Organizaciones",
    "Empresas, comercios, asociaciones e instituciones registradas en el municipio.",
  ),
  "/admin/documentacion": hoja(
    encabezado(
      "Gestión interna",
      "Documentación",
      "Lo que el municipio le pide a vecinos y organizaciones, con su plazo.",
    ),
    `<div class="cfa-pestanias">${linea(12, "cfa-linea--fuerte")}${linea(12, "cfa-linea--fuerte")}</div>`,
    controles(1),
    tabla(6),
  ),
  "/admin/expedientes": listado(
    "Gestión interna",
    "Expedientes",
    "El registro formal de lo que hace cada área.",
    2,
  ),
};

/** El fantasma de una sección del backoffice, por su ruta. Uno genérico si no tiene. */
export function htmlDelFantasma(ruta, titulo) {
  return FANTASMAS[ruta] ?? hoja(encabezado("Gestión interna", titulo, "", false), tabla(8));
}
