import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Campo, claseControl } from "./campo";

/**
 * Campo de fecha con calendario propio.
 *
 * Reemplaza a `<input type="date">`. El nativo es cómodo de escribir pero el
 * panel lo dibuja el navegador: no se puede usar la tipografía ni los colores
 * del sistema, y cada navegador muestra uno distinto.
 *
 * Lo que NO se perdió en el cambio: se sigue pudiendo tipear la fecha a mano.
 * Para una fecha de nacimiento escribir "08/03/1997" es más rápido que
 * cualquier calendario, y obligar a navegar hasta 1997 clic a clic sería un
 * retroceso. El calendario es la ayuda, no el único camino.
 *
 * Hacia afuera habla ISO (`aaaa-mm-dd`), igual que el input nativo, y emite
 * `{target:{value}}`. Por eso las pantallas que lo usan no cambiaron nada más
 * que el nombre del componente.
 */

const DIAS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

/** Cuántos años entran en una tanda: 4 columnas × 4 filas. */
const ANIOS_POR_TANDA = 16;
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Trampa clásica: `new Date("2026-09-20")` se parsea como UTC, y en Argentina
 * (UTC−3) eso es el 19 a las 21:00. `getDate()` devolvería 19. Todas las
 * fechas de acá se arman con partes locales para que el día sea el día.
 */
function deISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? "")) return null;
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  // Rechaza fechas imposibles como 31/02: el Date rebota al mes siguiente.
  if (fecha.getFullYear() !== a || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return null;
  return fecha;
}

function aISO(fecha) {
  if (!fecha) return "";
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${m}-${d}`;
}

/**
 * Hoy, en la zona horaria de quien usa la app.
 *
 * `new Date().toISOString().slice(0,10)` —que es lo que había en las pantallas—
 * da la fecha en UTC. Pasadas las 21:00 en Argentina eso ya es mañana, así que
 * un `max` de "no puede ser futuro" dejaba pasar el día siguiente.
 */
export const hoyISO = () => aISO(new Date());

/**
 * Corre una fecha ISO n días. Se hace sobre partes locales, no sumando
 * milisegundos: un día no siempre dura 86.400.000 ms —en los cambios de
 * horario dura 23 o 25 horas— y esa cuenta se corre de día.
 */
export const sumarDiasISO = (iso, n) => {
  const f = deISO(iso);
  return f ? aISO(sumarDias(f, n)) : "";
};

/** ISO -> lo que la persona lee y escribe. */
function aTextoAR(iso) {
  const f = deISO(iso);
  if (!f) return "";
  return `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()}`;
}

/**
 * Lo que la persona escribió -> ISO, o null si todavía no es una fecha.
 * Acepta separadores `/` y `-`, y años de dos dígitos no: "08/03/97" es
 * ambiguo (¿1997 o 2097?) y adivinar sería peor que pedir los cuatro dígitos.
 */
function deTextoAR(texto) {
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec((texto ?? "").trim());
  if (!m) return null;
  const [, d, mes, a] = m;
  return deISO(`${a}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`) ? `${a}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}` : null;
}

const sumarDias = (f, n) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n);
const sumarMeses = (f, n) => {
  const destino = new Date(f.getFullYear(), f.getMonth() + n, 1);
  // Si el día no existe en el mes destino (31 de enero + 1 mes), se queda en
  // el último día de ese mes en vez de saltar al siguiente.
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  return new Date(destino.getFullYear(), destino.getMonth(), Math.min(f.getDate(), ultimo));
};

const mismoDia = (a, b) => a && b && aISO(a) === aISO(b);

function fueraDeRango(fecha, min, max) {
  const iso = aISO(fecha);
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

/** Lunes primero: es como se lee un calendario acá. */
function diasDelMes(ancla) {
  const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  const corrimiento = (primero.getDay() + 6) % 7; // getDay() pone el domingo en 0
  const arranque = sumarDias(primero, -corrimiento);
  return Array.from({ length: 42 }, (_, i) => sumarDias(arranque, i));
}

export function CampoFecha({
  etiqueta,
  ayuda,
  error,
  obligatorio,
  className,
  value,
  onChange,
  min,
  max,
  disabled,
  ...props
}) {
  const [abierto, setAbierto] = useState(false);
  // Lo tipeado se guarda aparte del valor: mientras alguien escribe "08/0" el
  // campo todavía no representa una fecha, y pisar `value` en cada tecla haría
  // que el formulario viera basura.
  const [texto, setTexto] = useState(() => aTextoAR(value));

  useEffect(() => {
    setTexto(aTextoAR(value));
  }, [value]);

  const emitir = (iso) => onChange?.({ target: { value: iso } });

  /**
   * Una fecha completa se emite siempre, aunque caiga fuera de `min`/`max`.
   *
   * Tragarse el valor por estar fuera de rango parecía prolijo y era peor: el
   * formulario nunca se enteraba, su validación no corría y la persona no veía
   * ningún mensaje — el campo simplemente no reaccionaba. `min` y `max` acá
   * sirven para apagar los días en el calendario; decir *por qué* una fecha no
   * sirve es trabajo de la pantalla, que es la que sabe si el problema es
   * "no podés haber nacido mañana" o "el vencimiento no puede ser anterior al
   * inicio".
   */
  function alTipear(nuevo) {
    setTexto(nuevo);
    if (nuevo.trim() === "") return emitir("");
    const iso = deTextoAR(nuevo);
    if (iso) emitir(iso);
  }

  /** Al salir del campo se normaliza: o queda una fecha válida, o queda vacío. */
  function alSalir() {
    if (texto.trim() === "") return;
    const iso = deTextoAR(texto);
    if (iso) setTexto(aTextoAR(iso));
    else setTexto(aTextoAR(value));
  }

  return (
    <Campo
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      obligatorio={obligatorio}
      className={className}
    >
      {(propsCampo) => (
        <Popover.Root open={abierto} onOpenChange={setAbierto}>
          {/* El ancla es el campo entero, no el botón: así el panel sale del
              ancho del control, igual que el Selector. */}
          <Popover.Anchor asChild>
            <div className="relative">
              <input
                {...propsCampo}
                {...props}
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                autoComplete="off"
                disabled={disabled}
                value={texto}
                onChange={(e) => alTipear(e.target.value)}
                onBlur={alSalir}
                className={cn(
                  claseControl,
                  "h-control pr-11",
                  error ? "border-sello" : "border-borde-fuerte",
                )}
              />
              <Popover.Trigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Abrir calendario"
                  className={cn(
                    "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r",
                    "text-apagado transition-colors duration-150 hover:text-expediente",
                    "focus-visible:outline focus-visible:outline-2",
                    "focus-visible:outline-offset-[-2px] focus-visible:outline-expediente",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <CalendarDays className="size-[18px]" aria-hidden="true" />
                </button>
              </Popover.Trigger>
            </div>
          </Popover.Anchor>

          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className={cn(
                "panel-flotante z-50 rounded border border-borde-fuerte bg-superficie p-u2 shadow-lg",
                "w-[min(20rem,calc(100vw-2rem))]",
              )}
            >
              <Calendario
                valor={value}
                min={min}
                max={max}
                alElegir={(iso) => {
                  emitir(iso);
                  setTexto(aTextoAR(iso));
                  setAbierto(false);
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </Campo>
  );
}

/**
 * La grilla.
 *
 * Usa "roving tabindex": de los 42 días, uno solo es tabulable. Tabular no
 * debería obligar a pasar por seis semanas de botones para salir del panel;
 * dentro se navega con las flechas, que es lo que un calendario hace esperar.
 */
function Calendario({ valor, min, max, alElegir }) {
  const hoy = useMemo(() => new Date(), []);
  const elegida = deISO(valor);
  const [foco, setFoco] = useState(() => elegida ?? acotar(hoy, min, max));
  // "dias" | "meses" | "anios": tres niveles de zoom sobre la misma fecha.
  const [vista, setVista] = useState("dias");
  const grilla = useRef(null);
  const moverFocoAlPintar = useRef(false);

  const dias = useMemo(() => diasDelMes(foco), [foco]);

  // Después de mover el foco con el teclado hay que llevar el foco real del
  // navegador al botón nuevo, si no el lector de pantalla no sigue el recorrido.
  useLayoutEffect(() => {
    if (!moverFocoAlPintar.current) return;
    moverFocoAlPintar.current = false;
    grilla.current?.querySelector('[data-foco="si"]')?.focus();
  });

  function mover(nuevo) {
    if (fueraDeRango(nuevo, min, max)) return;
    moverFocoAlPintar.current = true;
    setFoco(nuevo);
  }

  function alTeclear(evento) {
    const teclas = {
      ArrowLeft: () => sumarDias(foco, -1),
      ArrowRight: () => sumarDias(foco, 1),
      ArrowUp: () => sumarDias(foco, -7),
      ArrowDown: () => sumarDias(foco, 7),
      Home: () => sumarDias(foco, -((foco.getDay() + 6) % 7)),
      End: () => sumarDias(foco, 6 - ((foco.getDay() + 6) % 7)),
      PageUp: () => sumarMeses(foco, evento.shiftKey ? -12 : -1),
      PageDown: () => sumarMeses(foco, evento.shiftKey ? 12 : 1),
    };
    const calcular = teclas[evento.key];
    if (!calcular) return;
    evento.preventDefault();
    mover(calcular());
  }

  // Inicio del bloque de años que se está mirando. Los años se pasan de a
  // tandas, como las hojas de un almanaque.
  const inicioTanda = Math.floor(foco.getFullYear() / ANIOS_POR_TANDA) * ANIOS_POR_TANDA;

  const pasoAtras = {
    dias: () => sumarMeses(foco, -1),
    meses: () => new Date(foco.getFullYear() - 1, foco.getMonth(), 1),
    anios: () => new Date(foco.getFullYear() - ANIOS_POR_TANDA, foco.getMonth(), 1),
  }[vista];

  const pasoAdelante = {
    dias: () => sumarMeses(foco, 1),
    meses: () => new Date(foco.getFullYear() + 1, foco.getMonth(), 1),
    anios: () => new Date(foco.getFullYear() + ANIOS_POR_TANDA, foco.getMonth(), 1),
  }[vista];

  const titulo = {
    dias: `${MESES[foco.getMonth()]} ${foco.getFullYear()}`,
    meses: String(foco.getFullYear()),
    anios: `${inicioTanda} – ${inicioTanda + ANIOS_POR_TANDA - 1}`,
  }[vista];

  return (
    <div>
      {/*
        El encabezado es la navegación entera.

        El título no es un rótulo: es un botón que baja un nivel de zoom.
        Desde los días muestra los meses, desde los meses los años. Es el
        mismo gesto del selector del navegador, y resuelve de una lo que con
        flechas es imposible: llegar a 1989 son más de cuatrocientos clics.

        Antes acá había dos desplegables. Funcionaban, pero eran un
        desplegable adentro de otro desplegable, y el calendario terminaba
        pareciendo un formulario en vez de un calendario.
      */}
      <div className="mb-u2 flex items-center gap-1">
        <BotonFlecha
          etiqueta={ETIQUETA_ATRAS[vista]}
          alPulsar={() => mover(pasoAtras())}
          deshabilitado={fueraDeRango(finDeMes(pasoAtras()), min, max)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </BotonFlecha>

        <button
          type="button"
          onClick={() => setVista(vista === "dias" ? "meses" : "anios")}
          disabled={vista === "anios"}
          aria-label={vista === "dias" ? "Elegir mes" : "Elegir año"}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5",
            "text-[length:var(--texto-dato)] font-medium text-tinta",
            "transition-colors duration-150 hover:bg-expediente-suave hover:text-expediente",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-expediente",
            "disabled:hover:bg-transparent disabled:hover:text-tinta",
          )}
        >
          <span className="first-letter:uppercase">{titulo}</span>
          {vista !== "anios" && (
            <ChevronDown className="size-3.5 text-apagado" aria-hidden="true" />
          )}
        </button>

        <BotonFlecha
          etiqueta={ETIQUETA_ADELANTE[vista]}
          alPulsar={() => mover(pasoAdelante())}
          deshabilitado={fueraDeRango(inicioDeMes(pasoAdelante()), min, max)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </BotonFlecha>
      </div>

      {vista === "dias" && (
        <>
          <div className="grid grid-cols-7 gap-0.5" role="presentation">
            {DIAS.map((d) => (
              <span
                key={d}
                aria-hidden="true"
                className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-apagado"
              >
                {d}
              </span>
            ))}
          </div>

          <div
            ref={grilla}
            role="grid"
            aria-label={`${MESES[foco.getMonth()]} de ${foco.getFullYear()}`}
            onKeyDown={alTeclear}
            className="grid grid-cols-7 gap-0.5"
          >
            {dias.map((dia) => {
              const deOtroMes = dia.getMonth() !== foco.getMonth();
              const deshabilitado = fueraDeRango(dia, min, max);
              const esElegida = mismoDia(dia, elegida);
              const tieneFoco = mismoDia(dia, foco);
              return (
                <button
                  key={aISO(dia)}
                  type="button"
                  role="gridcell"
                  data-foco={tieneFoco ? "si" : undefined}
                  tabIndex={tieneFoco ? 0 : -1}
                  disabled={deshabilitado}
                  aria-selected={esElegida}
                  aria-current={mismoDia(dia, hoy) ? "date" : undefined}
                  onClick={() => alElegir(aISO(dia))}
                  className={cn(
                    CELDA,
                    "h-9",
                    // `opacity-*` y no `text-apagado/50`: los tokens de color
                    // son `var(--apagado)` con un hex adentro, y el
                    // modificador de opacidad de Tailwind espera canales RGB
                    // sueltos. Con un hex genera CSS inválido, el navegador lo
                    // descarta y el texto queda del mismo color que el resto:
                    // los días deshabilitados se veían habilitados.
                    deOtroMes ? "text-apagado opacity-45" : "text-tinta",
                    !esElegida && !deshabilitado && "hover:bg-expediente-suave",
                    // Hoy se marca con un borde, no con relleno: el relleno es
                    // del día elegido y dos rellenos distintos compiten.
                    mismoDia(dia, hoy) && !esElegida && "ring-1 ring-inset ring-borde-fuerte",
                    esElegida && "bg-expediente font-medium text-white",
                    deshabilitado && "cursor-not-allowed text-apagado opacity-25 hover:bg-transparent",
                  )}
                >
                  {dia.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}

      {vista === "meses" && (
        <div className="grid grid-cols-4 gap-0.5" role="grid" aria-label="Elegir mes">
          {MESES.map((nombre, i) => {
            const primero = new Date(foco.getFullYear(), i, 1);
            const deshabilitado = fueraDeRango(primero, min, max) && fueraDeRango(finDeMes(primero), min, max);
            const esElegido = elegida?.getFullYear() === foco.getFullYear() && elegida?.getMonth() === i;
            return (
              <button
                key={nombre}
                type="button"
                role="gridcell"
                disabled={deshabilitado}
                aria-selected={esElegido}
                onClick={() => {
                  setFoco(new Date(foco.getFullYear(), i, 1));
                  setVista("dias");
                }}
                className={cn(
                  CELDA,
                  "h-11 capitalize",
                  !esElegido && !deshabilitado && "text-tinta hover:bg-expediente-suave",
                  esElegido && "bg-expediente font-medium text-white",
                  deshabilitado && "cursor-not-allowed text-apagado opacity-25",
                )}
              >
                {nombre.slice(0, 3)}
              </button>
            );
          })}
        </div>
      )}

      {vista === "anios" && (
        <div className="grid grid-cols-4 gap-0.5" role="grid" aria-label="Elegir año">
          {Array.from({ length: ANIOS_POR_TANDA }, (_, i) => inicioTanda + i).map((anio) => {
            const enero = new Date(anio, 0, 1);
            const diciembre = new Date(anio, 11, 31);
            const deshabilitado = fueraDeRango(enero, min, max) && fueraDeRango(diciembre, min, max);
            const esElegido = elegida?.getFullYear() === anio;
            return (
              <button
                key={anio}
                type="button"
                role="gridcell"
                disabled={deshabilitado}
                aria-selected={esElegido}
                onClick={() => {
                  setFoco(new Date(anio, foco.getMonth(), 1));
                  setVista("meses");
                }}
                className={cn(
                  CELDA,
                  "h-11",
                  !esElegido && !deshabilitado && "text-tinta hover:bg-expediente-suave",
                  esElegido && "bg-expediente font-medium text-white",
                  deshabilitado && "cursor-not-allowed text-apagado opacity-25",
                )}
              >
                {anio}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Lo que comparten las celdas de las tres vistas. */
const CELDA = cn(
  "flex items-center justify-center rounded-[2px] text-[length:var(--texto-dato)]",
  "transition-colors duration-150",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-expediente",
);

const ETIQUETA_ATRAS = { dias: "Mes anterior", meses: "Año anterior", anios: "Años anteriores" };
const ETIQUETA_ADELANTE = { dias: "Mes siguiente", meses: "Año siguiente", anios: "Años siguientes" };

function BotonFlecha({ etiqueta, alPulsar, deshabilitado, children }) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded",
        "text-apagado transition-colors duration-150",
        "hover:bg-expediente-suave hover:text-expediente",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-expediente",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
        "disabled:hover:text-apagado",
      )}
    >
      {children}
    </button>
  );
}

const finDeMes = (f) => new Date(f.getFullYear(), f.getMonth() + 1, 0);
const inicioDeMes = (f) => new Date(f.getFullYear(), f.getMonth(), 1);

function acotar(fecha, min, max) {
  const iso = aISO(fecha);
  if (min && iso < min) return deISO(min) ?? fecha;
  if (max && iso > max) return deISO(max) ?? fecha;
  return fecha;
}

