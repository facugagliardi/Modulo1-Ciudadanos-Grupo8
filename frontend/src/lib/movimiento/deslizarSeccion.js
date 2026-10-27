import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { elegirFantasmas, planDelSalto } from "./planSalto";

/**
 * El cambio de sección: **la pantalla actual se va empujada y la nueva entra
 * desde el lado opuesto**, siguiendo el orden del menú.
 *
 * - En el portal, en horizontal: ir a una pestaña de más a la derecha corre el
 *   contenido a la izquierda y trae la nueva desde la derecha.
 * - En el backoffice, en vertical, porque el menú es una columna: ir a un ítem
 *   de más abajo sube el contenido y trae la nueva desde abajo.
 *
 * Es el de la app de ZetaAccounting (`app/deslizarSeccion.ts`). Cuándo se
 * dispara lo decide `useEmpujon.js`.
 *
 * ### Es una View Transition, no dos pantallas montadas a la vez
 *
 * El navegador saca una foto de la pantalla vieja, se navega, saca una de la
 * nueva y desliza las dos en el compositor. El render de React pasa antes de que
 * arranque el movimiento, con la foto vieja quieta, así que una sección pesada
 * no le come cuadros al empujón.
 *
 * **Si en el medio quedan otras secciones, la tira pasa por delante de ellas**,
 * más rápido y desenfocada en proporción a la velocidad. Las cuentas están en
 * `planSalto.js`; las maquetas de las secciones del medio las arma quien llama.
 *
 * El movimiento lo dan **Web Animations sobre los pseudo-elementos** de la
 * transición: el recorrido cambia con cada salto y los números salen de un solo
 * lugar, el plan. El CSS (`transiciones.css`) sólo apaga las animaciones de
 * fábrica y deja afuera la cabecera y la barra lateral —son de donde salió el
 * click— y el pie del portal, que no es de ninguna pantalla.
 *
 * Sin `startViewTransition` (Firefox viejo), con movimiento reducido o sin
 * dirección, se navega en seco.
 */

/*
 * ---- Esperar a que React confirme la ruta ----------------------------------
 *
 * El `navigate` de React Router no cambia el DOM en el momento: con
 * `v7_startTransition` (ver `main.jsx`) la actualización va en un
 * `startTransition`. La foto nueva tiene que esperar el commit, y el aviso lo da
 * `useAvisoDeRuta` desde el layout, en un layout effect: corre con el DOM nuevo
 * ya puesto y antes de pintar.
 */
const esperando = new Set();

/** Cuánto se espera el commit como mucho. Pasado eso, la foto sale como esté. */
const MS_TOPE = 1200;

function esperarCommit() {
  return new Promise((listo) => {
    const terminar = () => {
      window.clearTimeout(reloj);
      esperando.delete(terminar);
      listo();
    };
    const reloj = window.setTimeout(terminar, MS_TOPE);
    esperando.add(terminar);
  });
}

/** Va en el layout: avisa cada cambio de ruta confirmado. */
export function useAvisoDeRuta() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    for (const terminar of [...esperando]) terminar();
  }, [pathname]);
}

/**
 * Si hay un empujón en curso. El layout lo mira al montar la pantalla nueva
 * para no sumarle la `.entrada`: la pantalla ya entra deslizándose.
 */
export function estaDeslizando() {
  return typeof document !== "undefined" && "seccion" in document.documentElement.dataset;
}

/*
 * Cada transición tiene su turno. Un segundo click mientras corre la primera la
 * corta —el navegador saltea la vieja y saca la foto desde donde está—, y el
 * `finally` de la vieja no puede borrarle la marca a la nueva.
 */
let turno = 0;

/*
 * Las animaciones del empujón en curso. Van con `fill: "both"` y apuntan a los
 * pseudo-elementos por nombre: una que quedara viva se le aplicaría a la foto
 * del mismo nombre de la transición siguiente. Se cancelan al terminar y cuando
 * otra transición corta a ésta.
 */
let animaciones = [];

function cancelarAnimaciones() {
  for (const a of animaciones) a.cancel();
  animaciones = [];
}

/**
 * @param {"izquierda" | "derecha" | "arriba" | "abajo" | null} direccion para
 *        dónde queda el destino en el menú; `null` navega sin animar
 * @param {string[]} fantasmas el HTML de las secciones del medio, de la vecina
 *        del origen a la vecina del destino. Se dibujan hasta tres.
 * @param {() => void} navegar el cambio de ruta. Corre entre las dos fotos.
 * @param {string} densidad la clase de densidad del layout, para los fantasmas
 */
export function deslizarSeccion(direccion, fantasmas, navegar, densidad = "densidad-holgada") {
  const sinMovimiento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!direccion || !document.startViewTransition || sinMovimiento) {
    navegar();
    return;
  }

  const raiz = document.documentElement;
  const mio = ++turno;
  cancelarAnimaciones();
  const elegidos = elegirFantasmas(fantasmas);
  const plan = planDelSalto(elegidos.length);
  let montados = [];
  /* Antes de pedir la transición: la foto vieja ya tiene que salir con la
     cabecera separada del resto, y eso lo decide el CSS colgado de este atributo. */
  raiz.dataset.seccion = direccion;
  /* Dónde está el pie en la foto vieja: en la nueva puede quedar a otra altura,
     porque cada sección mide distinto. */
  const pieAntes = document.querySelector("[data-pie]")?.getBoundingClientRect() ?? null;

  const transicion = document.startViewTransition(async () => {
    const confirmada = esperarCommit();
    navegar();
    /* Después de la foto vieja —que no los tiene que ver— y antes de la nueva. */
    montados = montarFantasmas(elegidos, densidad);
    await confirmada;
    /* La sección nueva entra desde su principio. `instant` porque acá no hay
       nada que ver: es entre las dos fotos. */
    window.scrollTo({ top: 0, behavior: "instant" });
  });

  void transicion.finished.finally(() => {
    for (const fantasma of montados) fantasma.remove();
    if (turno === mio) {
      delete raiz.dataset.seccion;
      cancelarAnimaciones();
    }
  });

  /* Una transición salteada rechaza `ready`; sin el segundo argumento, cada
     doble click deja un `AbortError` sin atrapar en la consola. */
  transicion.ready.then(
    () => {
      if (turno === mio) animaciones = empujar(direccion, plan, pieAntes);
    },
    () => {},
  );
}

/**
 * Mueve la tira entera: la foto vieja, los fantasmas y la nueva, pegados.
 *
 * En píxeles de la ventana y no en porcentajes: cada pieza es un pseudo-elemento
 * distinto y un `%` se resuelve contra el tamaño de cada uno; si una foto
 * midiera un píxel menos que otra, se abriría una raya entre las dos.
 */
function empujar(direccion, plan, pieAntes) {
  const raiz = document.documentElement;
  const vertical = direccion === "arriba" || direccion === "abajo";
  /* Ir hacia la derecha en la fila corre el contenido a la izquierda; ir hacia
     abajo en la columna lo sube. */
  const sentido = direccion === "derecha" || direccion === "abajo" ? -1 : 1;
  const largo = vertical ? window.innerHeight : window.innerWidth;
  const traslado = vertical ? "translateY" : "translateX";
  const viaje = sentido * plan.pantallas * largo;
  const creadas = [];

  const mover = (pseudoElement, desde) => {
    creadas.push(
      raiz.animate(
        [{ transform: `${traslado}(${desde}px)` }, { transform: `${traslado}(${desde + viaje}px)` }],
        { duration: plan.ms, easing: plan.curva, fill: "both", pseudoElement },
      ),
    );
    /* El desenfoque va en otra animación porque lleva otro reloj: sus muestras
       ya siguen la velocidad de la curva, así que corren en tiempo lineal. */
    if (plan.desenfoque.length > 0) {
      creadas.push(raiz.animate(plan.desenfoque, { duration: plan.ms, fill: "both", pseudoElement }));
    }
  };

  mover("::view-transition-old(root)", 0);
  for (let i = 1; i <= plan.fantasmas; i++) {
    mover(`::view-transition-new(cdn-tunel-${i})`, -sentido * i * largo);
  }
  mover("::view-transition-new(root)", -viaje);

  /* El pie no se va con la tira, pero si en la pantalla nueva queda a otra
     altura, va hasta ahí al mismo ritmo, sólo en vertical. Con `translate` y no
     `transform`: el `transform` del grupo es el que lo pone en su lugar. */
  const pie = document.querySelector("[data-pie]");
  if (pieAntes && pie) {
    const dy = pieAntes.top - pie.getBoundingClientRect().top;
    if (Math.abs(dy) >= 1) {
      creadas.push(
        raiz.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], {
          duration: plan.ms,
          easing: plan.curva,
          fill: "both",
          pseudoElement: "::view-transition-group(cdn-pie)",
        }),
      );
    }
  }
  return creadas;
}

/*
 * Los fantasmas son DOM suelto y no React a propósito: viven lo que dura la
 * transición, no tienen estado, y un render de React en el medio del cambio de
 * ruta sería trabajo de más justo antes de la foto nueva.
 *
 * Arrancan debajo de la cabecera y a la derecha de la barra lateral, que pasan
 * por encima y se quedan. Se mide el alto de la cabecera y no dónde está en
 * pantalla: la foto nueva sale con la página arriba de todo, aunque el click
 * haya sido con la página scrolleada. La barra lateral cuenta sólo si va al
 * costado del contenido: en el teléfono es un panel que se cierra al navegar.
 */
function montarFantasmas(htmls, densidad) {
  const arriba = document.querySelector("[data-cabecera]")?.offsetHeight ?? 0;
  const lateral = document.querySelector("[data-lateral]");
  const izquierda = lateral && getComputedStyle(lateral).position !== "fixed" ? lateral.offsetWidth : 0;
  return htmls.map((html, k) => {
    const fantasma = document.createElement("div");
    fantasma.className = `cdn-fantasma ${densidad}`;
    fantasma.setAttribute("aria-hidden", "true");
    fantasma.style.setProperty("view-transition-name", `cdn-tunel-${k + 1}`);
    fantasma.style.setProperty("--arriba", `${arriba}px`);
    fantasma.style.setProperty("--izquierda", `${izquierda}px`);
    fantasma.innerHTML = html;
    document.body.append(fantasma);
    return fantasma;
  });
}
