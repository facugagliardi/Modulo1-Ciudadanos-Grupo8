import { createContext, forwardRef, useContext, useRef, useState } from "react";

/**
 * Doble de `@radix-ui/react-select` para las pruebas.
 *
 * Por qué existe
 * --------------
 * Radix dibuja el panel del desplegable en un portal colgado del `<body>`, y
 * encima monta una pila de capas: trampa de foco, detección de clicks afuera,
 * bloqueo de punteros sobre el body y desmontaje diferido hasta que termina la
 * animación de salida. En un navegador todo eso encaja —está verificado a mano
 * en la app—, pero jsdom no tiene motor de animaciones ni captura de puntero,
 * así que esa coreografía queda a medio camino.
 *
 * El caso que lo hacía insalvable: un Selector adentro de un Diálogo. El panel
 * vive FUERA del diálogo en el DOM, así que al elegir una opción el diálogo lo
 * interpretaba como "me tocaron afuera" y se cerraba solo, con el formulario a
 * medio llenar, y la prueba fallaba tres líneas más abajo de donde estaba la
 * causa.
 *
 * Qué se sigue probando
 * ---------------------
 * Todo lo nuestro: cómo `Selector` arma las opciones, el mapeo del valor vacío
 * al centinela, la traducción a `onChange({target:{value}})` y cada pantalla
 * que lo usa. Lo que se reemplaza es la maquinaria interna de Radix, que ya
 * tiene sus propias pruebas y que verificamos en el navegador de verdad.
 *
 * El DOM que genera respeta el mismo contrato que el real —`role="combobox"`
 * en el disparador, `role="listbox"` en el panel, `role="option"` y
 * `data-valor` en cada opción—, así que las pruebas no saben que están
 * hablando con un doble.
 */

const Contexto = createContext(null);

export function Root({ value, onValueChange, disabled, children }) {
  const [abierto, setAbierto] = useState(false);
  // value -> texto visible, para que `Value` sepa qué mostrar.
  const textos = useRef(new Map());
  return (
    <Contexto.Provider value={{ value, onValueChange, disabled, abierto, setAbierto, textos }}>
      {children}
    </Contexto.Provider>
  );
}

export const Trigger = forwardRef(function Trigger({ children, ...props }, ref) {
  const ctx = useContext(Contexto);
  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-expanded={ctx.abierto}
      data-state={ctx.abierto ? "open" : "closed"}
      disabled={ctx.disabled}
      onPointerDown={() => !ctx.disabled && ctx.setAbierto(true)}
      onClick={() => !ctx.disabled && ctx.setAbierto((v) => !v)}
      {...props}
    >
      {children}
    </button>
  );
});

export function Value({ placeholder, className }) {
  const ctx = useContext(Contexto);
  const texto = ctx.textos.current.get(ctx.value);
  return (
    <span className={className} data-placeholder={texto ? undefined : ""}>
      {texto ?? placeholder ?? ""}
    </span>
  );
}

export function Icon({ children }) {
  return children ?? null;
}

/** Sin portal: el panel se queda donde nació. Ahí está la diferencia. */
export function Portal({ children }) {
  return children;
}

export function Content({ children, className }) {
  const ctx = useContext(Contexto);
  // Siempre montado para que las opciones alcancen a registrar su texto, pero
  // sólo visible —y sólo con rol de listbox— cuando está abierto.
  if (!ctx.abierto) {
    return (
      <div hidden data-state="closed">
        {children}
      </div>
    );
  }
  return (
    <div role="listbox" data-state="open" className={className}>
      {children}
    </div>
  );
}

export function Viewport({ children, className }) {
  return <div className={className}>{children}</div>;
}

const ContextoItem = createContext(null);

export function Item({ value, children, className, ...props }) {
  const ctx = useContext(Contexto);
  const elegido = ctx.value === value;
  return (
    <ContextoItem.Provider value={{ value, elegido }}>
      <div
        role="option"
        aria-selected={elegido}
        data-valor={value}
        data-highlighted={elegido ? "" : undefined}
        className={className}
        tabIndex={-1}
        onClick={() => {
          ctx.onValueChange?.(value);
          ctx.setAbierto(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            ctx.onValueChange?.(value);
            ctx.setAbierto(false);
          }
        }}
        {...props}
      >
        {children}
      </div>
    </ContextoItem.Provider>
  );
}

export function ItemText({ children }) {
  const ctx = useContext(Contexto);
  const item = useContext(ContextoItem);
  // Se registra acá porque es el único lugar que conoce el valor y su texto.
  if (item && typeof children === "string") {
    ctx.textos.current.set(item.value, children);
  }
  return <span>{children}</span>;
}

export function ItemIndicator({ children }) {
  const item = useContext(ContextoItem);
  return item?.elegido ? (children ?? null) : null;
}
