import { useLayoutEffect, useMemo, useRef } from "react";
import { useMotionValue, useReducedMotion } from "motion/react";
import { crearGoma } from "@/lib/movimiento/goma";

/**
 * **La línea de la pestaña activa, con goma.** Es la de las listas de pasos de
 * la landing de ZetaAccounting (`vitrinas/barraDeGoma.ts`): una sola barra que
 * va de una pestaña a la otra —no una por pestaña que se prende y se apaga—, así
 * dice de dónde venís. Al cambiar, se estira sobre la que deja y la que toma, y
 * después se contrae sobre la nueva con un rebote chico del borde de atrás.
 *
 * La usan la fila de secciones del portal y `ListaPestanias`. La pestaña activa
 * se encuentra sola por lo que ya marcan las dos: `aria-current="page"` en un
 * `NavLink` y `aria-selected="true"` en una pestaña de Radix. Por eso el hook no
 * recibe cuál es: escucha esos atributos con un `MutationObserver`, y cualquier
 * lista que los marque bien tiene su barra sin pasarle nada.
 *
 * La barra mide 1px y se estira con `scale`: el largo final es el factor. El
 * tramo se mide con `offsetLeft`/`offsetWidth`, contra la lista —que tiene que
 * ser `relative`—, así que viaja con el scroll horizontal de la fila.
 */

/** Los de Zeta, que son los de todas las píldoras de allá. */
const AJUSTE = { stretch: 40, squash: 2, speed: 1.85 };

const ACTIVA = '[aria-current="page"], [role="tab"][aria-selected="true"]';

function tramoActivo(lista, eje) {
  const el = lista.querySelector(ACTIVA);
  if (!el) return null;
  return eje === "x"
    ? { ini: el.offsetLeft, fin: el.offsetLeft + el.offsetWidth }
    : { ini: el.offsetTop + 3, fin: el.offsetTop + el.offsetHeight - 3 };
}

const iguales = (a, b) => a.ini === b.ini && a.fin === b.fin;

/**
 * @param {"x" | "y"} eje  "x" para una fila de pestañas, "y" para una lista.
 * @returns las refs de la lista y de la barra.
 */
export function useBarraDeGoma(eje = "x") {
  const lista = useRef(null);
  const barra = useRef(null);
  const reduce = useReducedMotion();
  const ini = useMotionValue(0);
  const fin = useMotionValue(0);
  const goma = useMemo(() => crearGoma(ini, fin), [ini, fin]);
  /* Dónde está la barra ahora: de acá sale el viaje a la pestaña nueva. */
  const actual = useRef(null);

  /* Escribe el tramo en la barra. Va antes que la medición: cuando se mide ya
     hay quien escuche. */
  useLayoutEffect(() => {
    const pintar = () => {
      const el = barra.current;
      if (!el) return;
      const largo = Math.max(0, fin.get() - ini.get());
      el.style.transform =
        eje === "x"
          ? `translateX(${ini.get()}px) scaleX(${largo})`
          : `translateY(${ini.get()}px) scaleY(${largo})`;
    };
    const quitar = [ini, fin].map((mv) => mv.on("change", pintar));
    pintar();
    return () => quitar.forEach((f) => f());
  }, [ini, fin, eje]);

  useLayoutEffect(() => {
    const caja = lista.current;
    if (!caja) return undefined;

    /* `viaje`: si la pestaña cambió, viaja; si no —la primera vez, un cambio de
       tamaño, las fuentes que llegan—, se acomoda en seco. */
    const ubicar = (viaje) => {
      const destino = tramoActivo(caja, eje);
      if (barra.current) barra.current.style.opacity = destino ? "1" : "0";
      const desde = actual.current;
      actual.current = destino;
      if (!destino) return;
      if (viaje && desde && !iguales(desde, destino)) {
        goma.viajar(desde, destino, { ...AJUSTE, reduce: !!reduce });
      } else {
        goma.saltar(destino);
      }
    };

    ubicar(false);
    const cambio = new MutationObserver(() => ubicar(true));
    cambio.observe(caja, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-current", "aria-selected"],
    });
    const tamano = new ResizeObserver(() => ubicar(false));
    tamano.observe(caja);
    let vivo = true;
    document.fonts?.ready.then(() => vivo && ubicar(false));
    return () => {
      vivo = false;
      cambio.disconnect();
      tamano.disconnect();
      goma.parar();
    };
  }, [eje, goma, reduce]);

  return { lista, barra };
}

/**
 * La barra. Va adentro de la lista, que tiene que ser `relative`.
 * `como="li"` cuando la lista es un `<ul>`: un `span` suelto ahí no es HTML válido.
 */
export function BarraDeGoma({ refBarra, eje = "x", como: Como = "span" }) {
  return <Como ref={refBarra} aria-hidden="true" className="barra-goma" data-eje={eje} />;
}
