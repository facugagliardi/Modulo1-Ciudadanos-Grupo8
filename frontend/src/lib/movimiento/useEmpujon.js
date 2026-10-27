import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { deslizarSeccion, estaDeslizando, useAvisoDeRuta } from "./deslizarSeccion";

/**
 * **El empujón de sección de un layout**: cambiar de sección empuja la pantalla
 * hacia el lado de su lugar en el menú, y si salta otras pasa por delante de
 * ellas. El movimiento está en `deslizarSeccion.js`; acá, decidir cuándo.
 *
 * - En el portal las pestañas van en fila (`eje: "x"`): la pantalla se corre de
 *   costado.
 * - En el backoffice el menú es una columna (`eje: "y"`): la pantalla se va para
 *   arriba o para abajo, como en la app de ZetaAccounting.
 *
 * No se engancha ítem por ítem sino **cualquier enlace** del layout: los del
 * menú, y también el "Cargar domicilio" del inicio o el "Ver expedientes" del
 * tablero, que llevan a otra sección. `alClickear` va en la fase de captura de
 * la raíz para llegar antes que el `Link`: con el `preventDefault` de acá, el
 * `Link` no navega.
 *
 * @param secciones las del menú, en su orden: `{ a, texto, exacto? }`
 * @param eje       `"x"` o `"y"`, cómo está puesto el menú; o una función que lo
 *                  dice en el momento del click, para un layout cuyo menú
 *                  cambia con el ancho
 * @param fantasma  `(ruta, texto) => html`: la maqueta de una sección del medio
 * @param densidad  la clase de densidad del layout, para los fantasmas
 * @returns `alClickear`, para el `onClickCapture` de la raíz, y `conEntrada`:
 *          si la pantalla de ahora lleva la `.entrada`. La que llega empujada
 *          no: ya entra deslizándose.
 */
export function useEmpujon({ secciones, eje, fantasma, densidad }) {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  useAvisoDeRuta();

  /* Se decide una vez por ruta, al montarla —el `<main>` lleva `key={pathname}`—:
     si la clase apareciera después, la animación arrancaría en ese momento. */
  const conEntrada = useMemo(() => !estaDeslizando(), [pathname]);

  function alClickear(e) {
    if (esClickEspecial(e)) return;
    const url = destinoDelClick(e);
    if (!url) return;
    const i = indiceDeSeccion(secciones, pathname);
    const j = indiceDeSeccion(secciones, url.pathname);
    /* La misma sección —volver a Organizaciones desde una organización— o una
       ruta sin lugar en el menú: lo resuelve el `Link`, en seco. */
    if (i < 0 || j < 0 || i === j) return;
    e.preventDefault();
    const medio = j > i ? secciones.slice(i + 1, j) : secciones.slice(j + 1, i).reverse();
    const haciaAdelante = j > i;
    const ejeAhora = typeof eje === "function" ? eje() : eje;
    deslizarSeccion(
      ejeAhora === "y" ? (haciaAdelante ? "abajo" : "arriba") : haciaAdelante ? "derecha" : "izquierda",
      medio.map((s) => fantasma(s.a, s.texto)),
      () => navegar(url.pathname + url.search + url.hash),
      densidad,
    );
  }

  return { alClickear, conEntrada };
}

/** La sección de una ruta: `/portal/organizaciones/7` es la de Organizaciones. */
function indiceDeSeccion(secciones, pathname) {
  return secciones.findIndex(({ a, exacto }) =>
    exacto ? pathname === a : pathname === a || pathname.startsWith(`${a}/`),
  );
}

/** Un click que el navegador resuelve por su cuenta: pestaña nueva, ventana nueva. */
const esClickEspecial = (e) =>
  e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * La ruta de la app a la que lleva el enlace del click, o `null` si el click no
 * es de un enlace que resuelva React Router: uno de otro sitio, uno que abre
 * otra pestaña o uno de descarga.
 */
function destinoDelClick(e) {
  const enlace = e.target.closest?.("a[href]");
  if (!enlace || enlace.hasAttribute("download")) return null;
  if (enlace.target && enlace.target !== "_self") return null;
  const url = new URL(enlace.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return url;
}
