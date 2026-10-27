/**
 * Las cuentas del empujón de sección, sin DOM: cuánto viaja, cuánto dura, con
 * qué curva y cuánto se desenfoca en cada momento. Vienen tal cual de
 * ZetaAccounting (`app/planSalto.ts`); el que las aplica es `deslizarSeccion.js`.
 *
 * ### Un salto largo pasa por delante de las secciones del medio
 *
 * Entre dos pestañas vecinas, el empujón es una tira de dos pantallas: la vieja
 * y la nueva. Si en el medio quedan otras, la tira las lleva también —como
 * "fantasmas", una maqueta con el nombre de la sección y la forma de sus
 * tarjetas— y la recorre entera, más rápido y **desenfocada en proporción a la
 * velocidad**: quieta en los extremos, borrosa en el medio, que es lo que hace
 * un barrido de cámara.
 *
 * El desenfoque no es una curva aparte elegida a ojo: sale de **derivar la
 * misma curva del movimiento**, así que el pico cae exactamente donde la tira va
 * más rápido.
 */

/**
 * **Nunca más de tres fantasmas.** A esa velocidad y con ese desenfoque tres se
 * leen igual que siete, y cada fantasma es una textura del tamaño de la pantalla
 * en la placa de video.
 */
export const MAX_FANTASMAS = 3;

/* El salto entre vecinas: ease-out, la respuesta al click. */
const CORTO = { ms: 520, curva: [0.22, 1, 0.36, 1] };

/*
 * El salto largo arranca acelerando —es lo que hace que se sienta que toma
 * velocidad para pasar por delante de las otras— y frena largo sobre la elegida.
 * Cada fantasma suma 80ms: la tira es más larga y tiene que alcanzar a leerse.
 */
const LARGO = { ms: 600, porFantasma: 80, curva: [0.5, 0, 0.1, 1] };

/* Píxeles de desenfoque en el pico: más fantasmas, más velocidad, más borroso. */
const DESENFOQUE_BASE = 6;
const DESENFOQUE_POR_FANTASMA = 3;
/* Cuántas muestras del desenfoque. La curva de la velocidad es suave: con 16 el
   tramo lineal entre muestra y muestra no se distingue. */
const MUESTRAS = 16;

/**
 * @param {number} intermedias cuántas secciones quedan en el medio
 * @returns {{ fantasmas: number, pantallas: number, ms: number, curva: string, desenfoque: Keyframe[] }}
 */
export function planDelSalto(intermedias) {
  const fantasmas = Math.max(0, Math.min(intermedias, MAX_FANTASMAS));
  if (fantasmas === 0) {
    return { fantasmas, pantallas: 1, ms: CORTO.ms, curva: cssBezier(CORTO.curva), desenfoque: [] };
  }
  const pico = DESENFOQUE_BASE + DESENFOQUE_POR_FANTASMA * fantasmas;
  const velocidad = velocidadDeBezier(LARGO.curva);
  const muestras = Array.from({ length: MUESTRAS + 1 }, (_, k) => velocidad(k / MUESTRAS));
  const maxima = Math.max(...muestras);
  return {
    fantasmas,
    pantallas: fantasmas + 1,
    ms: LARGO.ms + LARGO.porFantasma * fantasmas,
    curva: cssBezier(LARGO.curva),
    desenfoque: muestras.map((v, k) => ({
      offset: k / MUESTRAS,
      /* Redondeado a décimas: un `blur(3.0000000004px)` es el mismo cuadro. */
      filter: `blur(${Math.round(((pico * v) / maxima) * 10) / 10}px)`,
    })),
  };
}

/**
 * Las secciones del medio que se dibujan, de la más cercana al origen a la más
 * cercana al destino. Si sobran, se reparten parejas a lo largo del recorrido
 * —la primera y la última siempre—, así el salto sigue pasando por todo lo que
 * cruza y no sólo por el final.
 */
export function elegirFantasmas(intermedias, max = MAX_FANTASMAS) {
  if (intermedias.length <= max) return [...intermedias];
  if (max <= 1) return intermedias.slice(0, max);
  return Array.from(
    { length: max },
    (_, k) => intermedias[Math.round((k * (intermedias.length - 1)) / (max - 1))],
  );
}

function cssBezier([x1, y1, x2, y2]) {
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

/**
 * La velocidad de un `cubic-bezier` de CSS en el instante `t` (0–1): la derivada
 * del avance respecto del tiempo, `dy/dx`, que en la paramétrica es
 * `(dy/ds) / (dx/ds)`. Primero se busca el `s` cuyo `x` es `t`, por bisección:
 * la `x` de un bezier de CSS es siempre creciente, así que converge sin sorpresas.
 */
export function velocidadDeBezier([x1, y1, x2, y2]) {
  const coord = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;
  const deriv = (a, b, s) =>
    3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s ** 2;
  return (t) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mitad = (lo + hi) / 2;
      if (coord(x1, x2, mitad) < t) lo = mitad;
      else hi = mitad;
    }
    const s = (lo + hi) / 2;
    const dx = deriv(x1, x2, s);
    /* En los bordes `dx` puede ser 0 (x1 = 0): ahí la velocidad no se define y,
       para esta curva, vale 0 — arranca quieta. */
    return dx < 1e-6 ? 0 : deriv(y1, y2, s) / dx;
  };
}
