import { useCallback, useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TextoRoll } from "./TextoRoll";

/**
 * **La navegación en angosto**: la barra de arriba se queda con la marca y un
 * botón "Menú", y el menú tapa la pantalla entera. Es la `BarraMovil` de la app
 * de ZetaAccounting, con sus tres piezas:
 *
 * - **El botón**: "Menú" y "Cerrar" apilados en el mismo lugar, que se cruzan al
 *   abrir. La barra va por encima del menú, así el botón no se mueve: abrir y
 *   cerrar son el mismo gesto en el mismo lugar.
 * - **La cortina**: dos aspas opuestas que giran alrededor del centro de la
 *   pantalla, como un molinete. Es una sola capa quieta; lo que gira es su
 *   máscara (ver `menuMovil.css`).
 * - **Los destinos**: palabras grandes que entran en cascada, de arriba abajo,
 *   asomando detrás de un recorte. Al cerrar se hunden en el orden inverso y
 *   recién después vuelve la cortina. La sección activa lleva una barrita al
 *   costado.
 *
 * Lo usan el portal —debajo del ancho en el que ya no entra la fila de
 * pestañas— y el backoffice —debajo del ancho de la barra lateral—. Cada layout
 * lo esconde con su clase (`lg:hidden`, `md:hidden`).
 *
 * El estado vive en `useMenuMovil`, que comparten el botón (en la cabecera) y el
 * menú (afuera de ella): así el menú abierto se va con la foto vieja en el
 * empujón de sección, y la cabecera se queda.
 */

/**
 * Lo que tarda el cierre completo: primero se van los destinos y recién después
 * barre la cortina. Tiene que coincidir con el CSS.
 */
const MS_CIERRE = 780;

const sinMovimiento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * El estado del menú. Tres fases y no un booleano: una animación de CSS no se
 * reproduce al revés cuando se le saca la regla, así que `cerrando` es lo que
 * les da a los destinos de dónde irse. Dura lo que tarda la salida.
 */
export function useMenuMovil() {
  const id = useId();
  const { pathname } = useLocation();
  const [fase, setFase] = useState("cerrado");
  const abierto = fase === "abierto";
  const disparador = useRef(null);
  const relojCierre = useRef(0);

  /* Con movimiento reducido no hay salida que esperar: se cierra en el acto. */
  const cerrar = useCallback(() => {
    setFase((actual) => (actual !== "abierto" ? actual : sinMovimiento() ? "cerrado" : "cerrando"));
  }, []);

  const abrir = useCallback(() => {
    window.clearTimeout(relojCierre.current);
    setFase("abierto");
  }, []);

  /* Cerrar de golpe, sin la salida: para cuando lo que viene después tapa todo
     (salir de la sesión). */
  const cerrarYa = useCallback(() => {
    window.clearTimeout(relojCierre.current);
    setFase("cerrado");
  }, []);

  useEffect(() => {
    if (fase !== "cerrando") return undefined;
    relojCierre.current = window.setTimeout(() => setFase("cerrado"), MS_CIERRE);
    return () => window.clearTimeout(relojCierre.current);
  }, [fase]);

  /* Cambiar de ruta lo cierra, también con el botón de atrás del teléfono. En el
     render y no en un efecto, así no hay un cuadro con el menú abierto encima de
     la sección nueva. Y de golpe: el menú abierto ya está en la foto vieja y se
     va con ella en el empujón; su salida seguiría corriendo arriba de la nueva. */
  const [rutaDelMenu, setRutaDelMenu] = useState(pathname);
  if (rutaDelMenu !== pathname) {
    setRutaDelMenu(pathname);
    setFase("cerrado");
  }

  /* Escape cierra, y el foco vuelve al botón que abrió. */
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => {
      if (e.key !== "Escape") return;
      cerrar();
      disparador.current?.focus();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto, cerrar]);

  /* Con el menú abierto la página de atrás no scrollea: al cerrar aparecerías en
     otro lado. */
  useEffect(() => {
    if (!abierto) return undefined;
    const raiz = document.documentElement;
    const previo = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    return () => {
      raiz.style.overflow = previo;
    };
  }, [abierto]);

  /* Si la ventana se ensancha con el menú abierto, el botón desaparece y el menú
     quedaría tapando todo sin forma de cerrarlo. */
  useEffect(() => {
    const boton = disparador.current;
    if (!abierto || !boton || typeof ResizeObserver === "undefined") return undefined;
    const tamano = new ResizeObserver(() => {
      if (boton.offsetParent === null) cerrarYa();
    });
    tamano.observe(document.documentElement);
    return () => tamano.disconnect();
  }, [abierto, cerrarYa]);

  return { id, fase, abierto, abrir, cerrar, cerrarYa, disparador };
}

/** El botón de la barra: "Menú" y "Cerrar" en el mismo lugar. */
export function BotonDelMenu({ menu, className }) {
  return (
    <button
      ref={menu.disparador}
      type="button"
      className={cn("cmm-boton rueda", className)}
      onClick={() => (menu.abierto ? menu.cerrar() : menu.abrir())}
      aria-expanded={menu.abierto}
      aria-controls={menu.id}
    >
      <span className="cmm-boton__cara" aria-hidden={menu.abierto}>
        <TextoRoll texto="Menú" />
      </span>
      <span className="cmm-boton__cara" aria-hidden={!menu.abierto}>
        <TextoRoll texto="Cerrar" />
      </span>
    </button>
  );
}

/**
 * El menú a pantalla completa.
 *
 * @param grupos `[{ titulo, items: [{ a, texto, exacto? }] }]`, en el orden del
 *               menú de escritorio
 * @param pie    lo que va abajo de todo: quién está y el botón de salir. En
 *               angosto no hay otro lugar donde esté.
 */
export function MenuMovil({ menu, grupos, pie, className }) {
  const { pathname } = useLocation();

  /* Títulos e ítems en un solo contador corrido, en el orden en que se leen: la
     cascada baja una vez de arriba abajo, no una por grupo. */
  let n = 0;
  const escalonados = grupos.map((grupo) => ({
    titulo: grupo.titulo,
    indice: n++,
    items: grupo.items.map((item) => ({ ...item, indice: n++ })),
  }));

  return (
    <div
      className={cn("cmm-menu", className)}
      id={menu.id}
      data-fase={menu.fase}
      /* Cuántos escalonan: la salida los recorre al revés, desde el último. */
      style={{ "--cmm-n": n }}
      role="dialog"
      aria-modal="true"
      aria-label="Menú de secciones"
      inert={menu.abierto ? undefined : ""}
    >
      <div className="cmm-menu__cortina" aria-hidden="true" />

      {/* Cerrado no hay nada adentro: la cortina queda montada para que su
          barrido tenga desde dónde arrancar, y los destinos aparecen con su
          cascada al abrir. */}
      {menu.fase !== "cerrado" && (
        <div className="cmm-menu__adentro">
          <nav className="cmm-menu__grupos" aria-label="Secciones del menú">
            {escalonados.map((grupo) => (
              <div className="cmm-menu__grupo" key={grupo.titulo}>
                <p className="cmm-menu__titulo cmm-menu__entra" style={{ "--cmm-i": grupo.indice }}>
                  {grupo.titulo}
                </p>
                <ul className="cmm-menu__lista">
                  {grupo.items.map((item) => (
                    <li key={item.a} className="cmm-menu__entra" style={{ "--cmm-i": item.indice }}>
                      <NavLink
                        to={item.a}
                        end={item.exacto}
                        /* A otra sección, el menú se cierra con el cambio de
                           ruta y se va con la foto vieja. A la misma, no hay
                           cambio de ruta: se cierra acá, con su salida. */
                        onClick={() => {
                          if (pathname === item.a) menu.cerrar();
                        }}
                        className={({ isActive }) =>
                          cn("cmm-menu__enlace rueda", isActive && "cmm-menu__enlace--activo")
                        }
                      >
                        <TextoRoll texto={item.texto} />
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {pie && <div className="cmm-menu__pie">{pie}</div>}
        </div>
      )}
    </div>
  );
}
