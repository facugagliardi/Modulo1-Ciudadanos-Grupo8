/**
 * Los fantasmas del salto largo del portal: cómo se ve cada sección cuando la
 * tira pasa por delante de ella (ver `deslizarSeccion.js`). Es la idea de
 * `app/fantasmas.ts` de ZetaAccounting.
 *
 * **Cada sección tiene el suyo, con su título y la forma de sus tarjetas**: el
 * Inicio con sus dos columnas, Mis datos con la ficha, las listas con sus
 * renglones. Pasan desenfocados y en medio segundo, así que no se leen: lo que se
 * reconoce es la silueta de cada pantalla, y eso es lo que hace que el salto se
 * sienta como pasar de verdad por delante de ellas.
 *
 * **Son HTML en texto, no React.** Viven lo que dura una transición y no tienen
 * estado; montar las pantallas de verdad sería pedir sus datos para una foto. El
 * contenido son barras grises, no datos de nadie. Las clases (`.cfa-*`) son
 * propias, en `transiciones.css`, porque las de Tailwind que no usa ningún
 * componente no llegan al CSS final.
 *
 * Todo el texto es fijo y de este archivo, así que no hay nada que escapar.
 */

/* ---- Las piezas ----------------------------------------------------------- */

/** Un renglón gris; `ancho` en porcentaje. */
const linea = (ancho, clase = "") => `<span class="cfa-linea ${clase}" style="width:${ancho}%"></span>`;

const encabezado = (titulo, bajada) =>
  `<div class="cfa-encabezado"><p class="cfa-seccion">Portal del vecino</p><p class="cfa-titulo">${titulo}</p><p class="cfa-bajada">${bajada}</p></div>`;

/** Una tarjeta con título y renglones de los anchos que se le pasen. */
const tarjeta = (anchos, titulo = 40) =>
  `<div class="cfa-tarjeta"><div class="cfa-tarjeta__cab">${linea(titulo, "cfa-linea--fuerte")}</div><div class="cfa-tarjeta__cuerpo">${anchos
    .map((a) => linea(a))
    .join("")}</div></div>`;

/** Renglones de lista, cada uno con su chip de estado a la derecha. */
const lista = (n) =>
  `<div class="cfa-lista">${Array.from(
    { length: n },
    (_, i) =>
      `<div class="cfa-tarjeta cfa-renglon"><div class="cfa-renglon__texto">${linea(
        [46, 38, 52, 34][i % 4],
        "cfa-linea--fuerte",
      )}${linea([28, 34, 22, 30][i % 4])}</div><span class="cfa-chip"></span></div>`,
  ).join("")}</div>`;

/** Pares de rótulo y valor, en columnas. */
const ficha = (n) =>
  `<div class="cfa-tarjeta"><div class="cfa-tarjeta__cab">${linea(30, "cfa-linea--fuerte")}</div><div class="cfa-ficha">${Array.from(
    { length: n },
    (_, i) => `<div class="cfa-par">${linea(40)}${linea([70, 55, 80, 60][i % 4], "cfa-linea--fuerte")}</div>`,
  ).join("")}</div></div>`;

const columnas = (...hijos) => `<div class="cfa-columnas">${hijos.join("")}</div>`;

const hoja = (...hijos) => `<div class="cfa-hoja">${hijos.join("")}</div>`;

/* ---- Las secciones -------------------------------------------------------- */

const FANTASMAS = {
  "/portal": hoja(
    encabezado("Hola", "Lo que tenés pendiente y tus trámites, de un vistazo."),
    tarjeta([70, 55, 62]),
    columnas(tarjeta([60, 45, 50]), tarjeta([55, 65, 40])),
  ),
  "/portal/perfil": hoja(
    encabezado(
      "Mis datos",
      "Así figurás en el registro municipal. Mantenerlos al día evita demoras en tus trámites.",
    ),
    ficha(6),
    ficha(3),
  ),
  "/portal/domicilios": hoja(
    encabezado(
      "Mis domicilios",
      "Podés tener varios. Uno es el principal y es el que usa el municipio para notificarte.",
    ),
    lista(2),
    tarjeta([80, 80, 40], 30),
  ),
  "/portal/contactos": hoja(
    encabezado("Mi contacto", "Por acá te avisamos del estado de tus trámites."),
    lista(3),
    tarjeta([80, 40], 30),
  ),
  "/portal/familia": hoja(
    encabezado(
      "Mi grupo familiar",
      "Las personas con las que tenés un vínculo registrado en el municipio.",
    ),
    lista(3),
  ),
  "/portal/organizaciones": hoja(
    encabezado(
      "Mis organizaciones",
      "Las que son tuyas y aquellas en las que podés actuar en su nombre.",
    ),
    lista(3),
  ),
  "/portal/documentos": hoja(
    encabezado(
      "Mis documentos",
      "Lo que cargaste en el municipio. Un empleado los revisa y los valida.",
    ),
    lista(4),
  ),
  "/portal/documentacion-solicitada": hoja(
    encabezado(
      "Documentación que te piden",
      "Cuando el municipio necesita un papel tuyo para seguir con un trámite, aparece acá.",
    ),
    lista(2),
  ),
  "/portal/expedientes": hoja(
    encabezado("Mis expedientes", "Los trámites formales que el municipio abrió a tu nombre."),
    lista(3),
  ),
};

/** El fantasma de una sección del portal, por su ruta. Uno genérico si no tiene. */
export function htmlDelFantasma(ruta, titulo) {
  return FANTASMAS[ruta] ?? hoja(encabezado(titulo, ""), lista(3));
}
