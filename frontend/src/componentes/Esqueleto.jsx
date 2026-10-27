import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * **Esqueleto de cuadraditos que copia el layout de lo que carga.** Mientras
 * algo carga, en su lugar va *la misma pantalla* —sus tarjetas, sus íconos, sus
 * renglones de texto, sus botones— con cada pieza tapada por una grilla de
 * cuadraditos. Por la grilla pasa una ola: los cuadraditos crecen y se oscurecen
 * a medida que la cresta los cruza, en diagonal.
 *
 * Cuando llegan los datos, **el esqueleto se va de un barrido**: un frente cruza
 * de izquierda a derecha, cada cuadradito se achica hasta desaparecer cuando lo
 * alcanza —con un poco de desorden, para que el borde no sea una regla— y el
 * contenido aparece detrás del frente (`CargaConEsqueleto`).
 *
 * ### El molde
 *
 * No se dibuja a mano: se le pasa **el molde**, que es la pantalla real con datos
 * de ejemplo —o con los últimos que se vieron, ver `useUltimosDatos`—. Se monta
 * invisible y se buscan sus piezas:
 *
 * - **Cada renglón de texto**, del ancho exacto de lo escrito: el renglón que
 *   corta en dos son dos barras, como se ve.
 * - **Las piezas sólidas**: botones, campos, íconos, imágenes, y cualquier pieza
 *   en línea con fondo propio —un chip de estado, un botón hecho con un enlace—.
 *   Ésas van enteras, sin mirar lo que tienen adentro.
 * - `Hueso`, un bloque vacío para marcar a mano algo que no sea ninguna de esas.
 *
 * - **Los fondos**: lo que tiene fondo o borde propio —una tarjeta, una línea de
 *   tiempo—. Mientras carga pierde el blanco y el borde, y su superficie se llena
 *   de cuadraditos más chicos y más tenues que los de las piezas. El borde y el
 *   blanco vuelven con el barrido: son los del contenido, que aparece detrás.
 *
 * Los cuadraditos los pinta **un solo canvas encima de todo**: con un `div` por
 * cuadradito serían miles de nodos para algo que se redibuja en cada cuadro.
 *
 * Con movimiento reducido no hay ola ni barrido: los cuadraditos quedan quietos,
 * y al llegar los datos el contenido reemplaza al esqueleto en seco.
 */

/** Paso de la grilla y lado del cuadradito en reposo, en px. */
const CELDA = 7;
const LADO = 4;
/** En la cresta de la ola el cuadradito ocupa la celda casi entera. */
const LADO_CRESTA = 6;
/** Los del fondo del contenedor, más chicos: se tienen que notar sin competir. */
const LADO_FONDO = 3;
const LADO_FONDO_CRESTA = 5;

/** Una vuelta de la ola, y el ancho de la cresta medido en la diagonal. */
const ONDA_MS = 1600;
const CRESTA = 140;

/** El barrido de salida, y cuánto desorden tiene el borde del frente, en px. */
const BARRIDO_MS = 720;
const DESORDEN = 44;
/** Lo que avanza el frente mientras un cuadradito se achica, en px. */
const DESARME = 36;

/**
 * La curva con la que la caja pasa del alto del molde al del contenido: la de
 * salida del sistema (`--ease-salida`), que arranca decidida como el frente.
 */
const CURVA_ALTO = "cubic-bezier(0.165, 0.84, 0.44, 1)";

/** Lo mínimo que se ve el esqueleto, para que la ola alcance a pasar. */
export const MINIMO_MS = 650;

/** La barra de un renglón, en proporción al cuerpo de la letra. */
const ALTO_TEXTO = 0.85;

/**
 * Las piezas que van enteras. Además de éstas, cualquier pieza en línea con
 * fondo propio (ver `esSolida`).
 */
const SOLIDAS = "button, input, select, textarea, img, svg, video, canvas, [role='button'], [data-hueso]";

const sinMovimiento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Si hay con qué pintar. En jsdom no: ahí el esqueleto es sólo la forma. */
let hayCanvas;
function puedePintar() {
  hayCanvas ??= Boolean(document.createElement("canvas").getContext?.("2d"));
  return hayCanvas;
}

/** Si vale la pena la animación: sin canvas o con movimiento reducido, no. */
const animable = () => puedePintar() && !sinMovimiento();

/** `#e4e1da` → `[228, 225, 218]`. Los tokens del sistema son todos hex de 6. */
function rgb(token, fallback) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(valor);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Un número de 0 a 1 fijo para cada posición. Es el grano del reposo y el
 * desorden del barrido: si fuera `Math.random()`, cada vez que se remide la
 * grilla —el esqueleto pasa a ir encima del contenido al arrancar el barrido—
 * el grano cambiaría de golpe.
 */
function ruidoDe(x, y) {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Un bloque vacío que el esqueleto rellena entero. Para lo que no se detecta solo. */
export function Hueso({ className }) {
  return <span data-hueso="" className={cn("block", className)} />;
}

const sinFondo = (color) => color === "transparent" || /^rgba\(.*,\s*0\)$/.test(color);

/**
 * Una pieza en línea con fondo propio: un chip, un botón hecho con un `<a>`. Una
 * tarjeta también tiene fondo, pero es de bloque: es marco, no pieza.
 */
function esSolida(el) {
  if (el.matches(SOLIDAS)) return true;
  const estilo = getComputedStyle(el);
  return estilo.display.startsWith("inline") && !sinFondo(estilo.backgroundColor);
}

const tieneBorde = (estilo) =>
  ["Top", "Right", "Bottom", "Left"].some(
    (lado) => parseFloat(estilo[`border${lado}Width`]) > 0 && !sinFondo(estilo[`border${lado}Color`]),
  );

/**
 * Marca las piezas del molde. **Una sola vez**: el CSS esconde lo marcado —y a
 * los fondos les saca el color y el borde—, así que después los estilos ya no
 * dicen qué era cada cosa. Las remediciones leen las marcas.
 *
 * - `data-esq-pieza`: va entera en cuadraditos y se vuelve invisible.
 * - `data-esq-fondo`: un marco —una tarjeta, una línea de tiempo— que pierde su
 *   fondo y su borde mientras carga. `="afuera"` en el de más afuera de cada
 *   zona, que es el que se rellena: uno adentro de otro pintaría dos veces.
 */
function clasificar(molde) {
  /* En orden de documento: los padres primero, así lo de adentro de una pieza
     se saltea y se sabe si un fondo está adentro de otro. */
  for (const el of molde.querySelectorAll("*")) {
    if (el.parentElement?.closest("[data-esq-pieza]")) continue;
    if (esSolida(el)) {
      el.setAttribute("data-esq-pieza", "");
      continue;
    }
    const estilo = getComputedStyle(el);
    if (!sinFondo(estilo.backgroundColor) || tieneBorde(estilo)) {
      el.setAttribute("data-esq-fondo", el.parentElement?.closest("[data-esq-fondo]") ? "" : "afuera");
    }
  }
}

/**
 * Los rectángulos a rellenar, relativos a `raiz`: los de las piezas —cada pieza
 * marcada y cada renglón de texto que no esté adentro de una— y los de los fondos.
 */
function medir(raiz, molde) {
  const origen = raiz.getBoundingClientRect();
  const relativo = (r) => ({ left: r.left - origen.left, top: r.top - origen.top, width: r.width, height: r.height });
  const piezas = [];
  const agregar = (r) => {
    if (r.width >= 3 && r.height >= 3) piezas.push(relativo(r));
  };

  molde.querySelectorAll("[data-esq-pieza]").forEach((el) => agregar(el.getBoundingClientRect()));

  const textos = document.createTreeWalker(molde, NodeFilter.SHOW_TEXT);
  const rango = document.createRange();
  for (let nodo = textos.nextNode(); nodo; nodo = textos.nextNode()) {
    if (!nodo.textContent.trim() || nodo.parentElement.closest("[data-esq-pieza]")) continue;
    const cuerpo = parseFloat(getComputedStyle(nodo.parentElement).fontSize) || 16;
    rango.selectNodeContents(nodo);
    /* Un rectángulo por renglón. La barra va del alto de la letra y no del
       renglón entero, centrada: si no, dos renglones se pegarían. */
    for (const r of rango.getClientRects?.() ?? []) {
      const alto = Math.min(r.height, cuerpo * ALTO_TEXTO);
      agregar({ left: r.left, top: r.top + (r.height - alto) / 2, width: r.width, height: alto });
    }
  }

  const fondos = [...molde.querySelectorAll('[data-esq-fondo="afuera"]')].map((el) =>
    relativo(el.getBoundingClientRect()),
  );
  return { piezas, fondos, ancho: origen.width, alto: origen.height };
}

/**
 * Las celdas de cada rectángulo. La grilla va alineada a cada pieza y centrada en
 * ella, así ninguna queda con media fila cortada; la ola usa la posición
 * absoluta, así que cruza de una pieza a la otra sin cortes.
 */
function celdasDe(rects, pieza, excluir = []) {
  const celdas = [];
  /* El fondo no se pinta debajo de las piezas: dos grillas encimadas se ven sucias. */
  const tapada = (x, y) =>
    excluir.some((e) => x > e.left - 3 && x < e.left + e.width + 3 && y > e.top - 3 && y < e.top + e.height + 3);
  for (const r of rects) {
    const columnas = Math.max(1, Math.floor((r.width + CELDA - LADO_CRESTA) / CELDA));
    const filas = Math.max(1, Math.floor((r.height + CELDA - LADO_CRESTA) / CELDA));
    const x0 = r.left + (r.width - ((columnas - 1) * CELDA + LADO_CRESTA)) / 2;
    const y0 = r.top + (r.height - ((filas - 1) * CELDA + LADO_CRESTA)) / 2;
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < columnas; c++) {
        const x = x0 + c * CELDA + LADO_CRESTA / 2;
        const y = y0 + f * CELDA + LADO_CRESTA / 2;
        if (!pieza && tapada(x, y)) continue;
        celdas.push({ x, y, pieza, ruido: ruidoDe(Math.round(x), Math.round(y)) });
      }
    }
  }
  return celdas;
}

const suave = (u) => u * u * (3 - 2 * u);
const mezclar = (a, b, w) => a.map((v, i) => Math.round(v + (b[i] - v) * w));

/**
 * El molde con sus piezas en cuadraditos.
 *
 * @param etiqueta   lo que se anuncia mientras carga; `null` para una pieza que
 *                   acompaña a otra que ya lo anuncia, así no se oye dos veces
 * @param saliendo   cuando pasa a `true`, arranca el barrido de salida
 * @param alAvanzar  en cada cuadro del barrido, hasta dónde ya no queda esqueleto (px desde la izquierda)
 * @param alSalir    cuando el último cuadradito desapareció
 */
export function Esqueleto({ etiqueta = "Cargando…", saliendo = false, alAvanzar, alSalir, className, children }) {
  const raiz = useRef(null);
  const molde = useRef(null);
  const lienzo = useRef(null);
  /* Para leerlos desde el bucle sin rearmarlo en cada render. */
  const salida = useRef({ desde: null });
  Object.assign(salida.current, { saliendo, alAvanzar, alSalir });

  /* En un layout effect: las piezas se esconden antes de la primera pintura, sin
     un cuadro con el botón azul a la vista. */
  useLayoutEffect(() => {
    const caja = raiz.current;
    const canvas = lienzo.current;
    if (!caja || !molde.current || !canvas) return undefined;
    /* Se marca aunque no haya con qué pintar: así el molde queda invisible igual. */
    clasificar(molde.current);
    let medida = medir(caja, molde.current);
    if (!puedePintar()) return undefined;
    const ctx = canvas.getContext("2d");

    /* El fondo, tenue: del color de los bordes, que se oscurece hacia el de los
       bordes fuertes en la cresta. Las piezas, un escalón más arriba: arrancan en
       el de los bordes fuertes y en la cresta van hacia el del texto apagado. */
    const borde = rgb("--borde", [228, 225, 218]);
    const bordeFuerte = rgb("--borde-fuerte", [201, 196, 184]);
    const apagado = rgb("--apagado", [43, 51, 61]);
    const COLORES = {
      fondo: [borde, bordeFuerte],
      pieza: [bordeFuerte, mezclar(bordeFuerte, apagado, 0.28)],
    };
    const quieto = sinMovimiento();
    let celdas = [];
    let cuadro = 0;
    const inicio = performance.now();

    const ajustar = () => {
      medida = medir(caja, molde.current);
      /* Primero el fondo, así las piezas quedan encima. */
      celdas = [...celdasDe(medida.fondos, false, medida.piezas), ...celdasDe(medida.piezas, true)];
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(medida.ancho * dpr);
      canvas.height = Math.round(medida.alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /* Devuelve `false` cuando el barrido terminó. */
    const pintar = (ahora) => {
      const { ancho, alto } = medida;
      ctx.clearRect(0, 0, ancho, alto);
      const s = salida.current;

      /* El barrido: dónde está el frente, con un ease-out —arranca decidido y
         frena al llegar al borde—. Recorre el ancho más el desorden y el desarme,
         así el último cuadradito también alcanza a achicarse. */
      let frente = null;
      if (s.saliendo) {
        s.desde ??= ahora;
        const p = Math.min(1, (ahora - s.desde) / BARRIDO_MS);
        const avance = 1 - (1 - p) ** 2.2;
        frente = avance * (ancho + DESORDEN + DESARME);
        /* Detrás de `frente - DESORDEN - DESARME` ya no queda ningún cuadradito. */
        s.alAvanzar?.(Math.max(0, frente - DESARME));
        if (p >= 1) return false;
      }

      /* La cresta recorre la diagonal entera y vuelve a entrar por la izquierda. */
      const largo = ancho + alto * 0.5 + 2 * CRESTA;
      const posCresta = quieto ? -Infinity : (((ahora - inicio) % ONDA_MS) / ONDA_MS) * largo - CRESTA;

      for (const celda of celdas) {
        const w = suave(Math.max(0, 1 - Math.abs(celda.x + celda.y * 0.5 - posCresta) / CRESTA));
        const [reposo, enCresta] = celda.pieza ? [LADO, LADO_CRESTA] : [LADO_FONDO, LADO_FONDO_CRESTA];
        let lado = reposo + (enCresta - reposo) * w;
        if (frente !== null) {
          const k = Math.min(1, Math.max(0, (frente - celda.x - celda.ruido * DESORDEN) / DESARME));
          lado *= (1 - k) ** 2;
          if (lado < 0.4) continue;
        }
        const [desde, hasta] = celda.pieza ? COLORES.pieza : COLORES.fondo;
        const [r, g, b] = mezclar(desde, hasta, w);
        ctx.globalAlpha = celda.pieza ? 0.8 + celda.ruido * 0.2 : 0.5 + celda.ruido * 0.25 + w * 0.25;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(celda.x - lado / 2, celda.y - lado / 2, lado, lado);
      }
      ctx.globalAlpha = 1;
      return true;
    };

    const bucle = (ahora) => {
      if (pintar(ahora)) cuadro = requestAnimationFrame(bucle);
      else salida.current.alSalir?.();
    };

    /* Cambiarle el tamaño al canvas lo borra: se repinta en el acto, sin esperar
       al cuadro siguiente. Así la pantalla que entra empujada ya llega con los
       cuadraditos puestos —la foto nueva sale antes del primer cuadro de la
       ola— y una remedición no deja un cuadro en blanco. */
    const remedir = () => {
      ajustar();
      pintar(performance.now());
    };

    remedir();
    /* Con el ancho cambian los cortes de renglón; con las fuentes, los anchos. */
    const tamano = new ResizeObserver(remedir);
    tamano.observe(caja);
    let vivo = true;
    document.fonts?.ready.then(() => vivo && remedir());
    cuadro = requestAnimationFrame(bucle);
    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      tamano.disconnect();
    };
  }, []);

  /* Sin animación no hay barrido que esperar. */
  useEffect(() => {
    if (saliendo && !animable()) salida.current.alSalir?.();
  }, [saliendo]);

  return (
    <div
      ref={raiz}
      role={saliendo || etiqueta === null ? undefined : "status"}
      aria-hidden={saliendo || etiqueta === null || undefined}
      className={cn("relative", className)}
    >
      {etiqueta !== null && <span className="sr-only">{etiqueta}</span>}
      {/* El molde: se ve el marco y nada más (`.esq-molde` en `transiciones.css`).
          `inert` porque son botones y campos de verdad: no se tocan ni se enfocan. */}
      <div ref={molde} className="esq-forma esq-molde" aria-hidden="true" inert="">
        {children}
      </div>
      <canvas ref={lienzo} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />
    </div>
  );
}

/**
 * Muestra el `molde` en cuadraditos mientras `cargando`, y al terminar cambia al
 * contenido con el barrido: el esqueleto se va de izquierda a derecha y el
 * contenido aparece detrás del frente. Los dos se enmascaran con degradés que
 * siguen al frente (`--frente`, ver `transiciones.css`).
 *
 * El molde conviene que sea **el mismo componente que el contenido**, con datos
 * de ejemplo o con los últimos vistos: así el esqueleto es la pantalla, y en el
 * barrido el marco de uno cae exacto sobre el del otro.
 *
 *   <CargaConEsqueleto cargando={r.cargando} molde={<Lista items={ultimos ?? []} />}>
 *     <Lista items={r.datos} />
 *   </CargaConEsqueleto>
 *
 * Si los datos llegan antes de `MINIMO_MS`, el esqueleto se queda hasta
 * cumplirlo: con la API local la respuesta tarda unos milisegundos, y un
 * esqueleto que aparece y se barre en el mismo instante se lee como un parpadeo.
 *
 * Si al montarse ya no está cargando, va directo al contenido, sin esqueleto.
 *
 * **Si el contenido no mide lo mismo que el molde, la caja cambia de alto de a
 * poco**, al ritmo del barrido: lo que hay debajo —la paginación de una tabla, la
 * tarjeta siguiente— se corre suave hasta su lugar en vez de saltar. Mientras
 * tanto la caja recorta, así el esqueleto más alto no se dibuja encima de lo de
 * abajo.
 *
 * El esqueleto y el contenido van siempre en el mismo lugar del árbol, para que
 * React no los vuelva a montar entre una fase y otra: la ola no salta al empezar
 * el barrido, y el contenido que apareció barriendo es el mismo que queda.
 */
export function CargaConEsqueleto({ cargando, molde, etiqueta, className, children }) {
  /* `molde` puede ser una función: así se arma sólo mientras hace falta. */
  const [fase, setFase] = useState(cargando ? "cargando" : "listo");
  const [minimoCumplido, setMinimoCumplido] = useState(!cargando || !animable());
  const caja = useRef(null);

  useEffect(() => {
    if (minimoCumplido) return undefined;
    const reloj = window.setTimeout(() => setMinimoCumplido(true), MINIMO_MS);
    return () => window.clearTimeout(reloj);
  }, [minimoCumplido]);

  /* Volvió a cargar desde cero —cambió la consulta—: vuelve el esqueleto. */
  if (cargando && fase !== "cargando") {
    setFase("cargando");
    setMinimoCumplido(!animable());
  }
  /* Sin animación no hay barrido: el contenido reemplaza al molde en seco, y los
     dos no llegan a estar montados a la vez. */
  if (!cargando && minimoCumplido && fase === "cargando") setFase(animable() ? "barriendo" : "listo");

  /* El alto de la caja en el último cuadro pintado. Un `ResizeObserver` avisa
     después del layout, así que en el layout effect de una fase nueva todavía
     tiene el alto de la anterior: es el punto de partida del acomodo. */
  const alto = useRef(null);
  const acomodo = useRef(null);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    alto.current = el.getBoundingClientRect().height;
    const tamano = new ResizeObserver(() => {
      alto.current = el.getBoundingClientRect().height;
    });
    tamano.observe(el);
    return () => {
      tamano.disconnect();
      acomodo.current?.cancel();
    };
  }, []);

  /* Antes de pintar: el contenido arranca tapado, sin un cuadro a la vista. */
  useLayoutEffect(() => {
    const el = caja.current;
    if (fase === "barriendo") el?.style.setProperty("--frente", "0px");

    /* Al pasar del molde al contenido —o de vuelta, si recarga—, del alto de
       antes al de ahora. Al terminar el barrido el alto no cambia: el esqueleto
       ya iba encima, fuera del flujo. */
    const antes = alto.current;
    if (fase === "listo" || antes == null || !el?.animate || !animable()) return;
    const despues = el.getBoundingClientRect().height;
    if (Math.abs(despues - antes) < 1) return;
    acomodo.current?.cancel();
    acomodo.current = el.animate(
      [
        { height: `${antes}px`, overflow: "clip" },
        { height: `${despues}px`, overflow: "clip" },
      ],
      { duration: BARRIDO_MS, easing: CURVA_ALTO },
    );
  }, [fase]);

  return (
    // `className` es para el tamaño, cuando el contenido lo toma del contenedor
    // (un visor con `h-full`): la capa del contenido ocupa todo el alto.
    <div ref={caja} className={cn("relative", fase === "barriendo" && "esq-barriendo", className)}>
      {fase !== "cargando" && <div className="esq-revelando h-full">{children}</div>}
      {fase !== "listo" && (
        <div className={cn(fase === "barriendo" && "pointer-events-none absolute inset-x-0 top-0")}>
          <Esqueleto
            etiqueta={etiqueta}
            saliendo={fase === "barriendo"}
            alAvanzar={(frente) => caja.current?.style.setProperty("--frente", `${frente}px`)}
            alSalir={() => setFase("listo")}
          >
            {/* Sin canvas no hay cuadraditos que ponerle encima: el molde sería
                sólo marco vacío. Queda el aviso de carga para el lector. */}
            {puedePintar() && (typeof molde === "function" ? molde() : molde)}
          </Esqueleto>
        </div>
      )}
    </div>
  );
}

/**
 * **La forma corta, para lo que carga con `useRecurso`.** El contenido se escribe
 * una sola vez, como una función de los datos, y de ahí salen las dos cosas: el
 * contenido con los datos de verdad y el molde con los últimos que se vieron —o
 * con `ejemplo`, la primera vez—.
 *
 *   <ConEsqueleto recurso={contactos} clave={`contactos:${id}`} ejemplo={[]}>
 *     {(lista) => (lista.length === 0 ? <Vacio /> : <Lista items={lista} />)}
 *   </ConEsqueleto>
 *
 * `ejemplo` decide cómo se ve la primera carga: `[]` para una lista personal
 * —casi siempre arranca vacía—, un objeto con datos de largo típico para una
 * ficha. El error lo sigue mostrando la pantalla: no es contenido.
 *
 * @param clave    lleva el id de quien está logueado, ver `useUltimosDatos`
 * @param children `(datos) => contenido`
 */
export function ConEsqueleto({ recurso, clave, ejemplo, etiqueta, children: dibujar }) {
  const ultimos = useUltimosDatos(clave, recurso.datos);
  return (
    <CargaConEsqueleto
      cargando={recurso.cargando}
      etiqueta={etiqueta}
      molde={() => dibujar(ultimos ?? ejemplo)}
    >
      {recurso.datos != null && dibujar(recurso.datos)}
    </CargaConEsqueleto>
  );
}

/*
 * Los últimos datos de cada pantalla, para el molde. Sólo en memoria y sólo
 * durante la sesión de la pestaña: no se guardan en ningún lado. La clave lleva
 * el id de quien está logueado, así el molde de una persona nunca sale con los
 * datos de otra.
 */
const ultimos = new Map();

/**
 * Los datos de ahora o, mientras todavía no llegaron, los últimos que se vieron
 * con esta clave. Es lo que hace que el esqueleto de una pantalla a la que se
 * vuelve tenga exactamente su forma: la misma cantidad de tarjetas, los mismos
 * renglones.
 *
 * @returns los datos, los últimos vistos, o `null` si nunca hubo
 */
export function useUltimosDatos(clave, datos) {
  useEffect(() => {
    if (datos != null) ultimos.set(clave, datos);
  }, [clave, datos]);
  return datos ?? ultimos.get(clave) ?? null;
}

/** Olvida todo lo recordado. Para las pruebas, que no se pasen datos entre sí. */
export function olvidarUltimosDatos() {
  ultimos.clear();
}
