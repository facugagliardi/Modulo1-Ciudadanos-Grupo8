import { animate } from "motion/react";

/**
 * El viaje de goma, traído de ZetaAccounting (`components/reactbits/goma.ts`):
 * **un tramo que va de una posición a otra estirándose sobre las dos y después
 * se contrae**, con un rebote chico del borde de atrás.
 *
 * El tramo son dos bordes sobre un eje —izquierda y derecha en una fila de
 * pestañas, arriba y abajo en una lista vertical—, en píxeles. `squash` va en
 * esa misma unidad.
 *
 * Los dos bordes son `MotionValue` y no estado de React: la barra se pinta
 * escribiendo el `transform` directo en el DOM (ver `BarraDeGoma.jsx`).
 */

const EASE_OUT = [0.23, 1, 0.32, 1];
const SPRING_UI = { type: "spring", duration: 0.3, bounce: 0 };
const SPRING_RELAX = { type: "spring", duration: 0.16, bounce: 0 };
/** Lo que dura el estirón, antes de la velocidad. */
const DILATE = 0.19;
/** Cuándo le pasa la posta el estirón a la llegada. */
const HANDOFF = 0.15;

/**
 * @param {import("motion/react").MotionValue<number>} ini
 * @param {import("motion/react").MotionValue<number>} fin
 */
export function crearGoma(ini, fin) {
  /* Cada viaje nuevo invalida el rebote pendiente del anterior. */
  let gen = 0;
  let posta = 0;

  const saltar = (a) => {
    window.clearTimeout(posta);
    gen += 1;
    ini.jump(a.ini);
    fin.jump(a.fin);
  };

  /* La llegada: el borde de adelante entra con el resorte y el de atrás se pasa
     `squash` y vuelve. */
  const llegar = (b, { squash, speed }) => {
    const t = (s) => s / speed;
    const g = ++gen;
    const dir = Math.sign((b.ini + b.fin) / 2 - (ini.get() + fin.get()) / 2) || 1;
    const [lead, leadTo, trail, trailTo] =
      dir > 0 ? [fin, b.fin, ini, b.ini] : [ini, b.ini, fin, b.fin];
    animate(lead, leadTo, { ...SPRING_UI, duration: t(0.3), velocity: lead.getVelocity() });
    if (squash <= 0) {
      animate(trail, trailTo, { ...SPRING_UI, duration: t(0.3), velocity: trail.getVelocity() });
      return;
    }
    void animate(trail, trailTo + dir * squash, {
      ...SPRING_UI,
      duration: t(0.3),
      velocity: trail.getVelocity(),
    }).then(() => {
      if (gen === g) animate(trail, trailTo, { ...SPRING_RELAX, duration: t(0.16) });
    });
  };

  /* El viaje: se estira sobre los dos tramos (`stretch`, en porcentaje) y a
     mitad de camino le pasa la posta a `llegar`. */
  const viajar = (a, b, ajuste) => {
    window.clearTimeout(posta);
    gen += 1;
    if (ajuste.reduce) {
      ini.jump(b.ini);
      fin.jump(b.fin);
      return;
    }
    const t = (s) => s / ajuste.speed;
    const u = ajuste.stretch / 100;
    const tween = { duration: t(DILATE), ease: EASE_OUT };
    animate(ini, b.ini + (Math.min(a.ini, b.ini) - b.ini) * u, tween);
    animate(fin, b.fin + (Math.max(a.fin, b.fin) - b.fin) * u, tween);
    posta = window.setTimeout(() => llegar(b, ajuste), t(HANDOFF) * 1000);
  };

  const parar = () => {
    window.clearTimeout(posta);
    ini.stop();
    fin.stop();
  };

  return { saltar, viajar, parar };
}
