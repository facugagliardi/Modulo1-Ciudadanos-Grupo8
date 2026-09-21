import { forwardRef, useId, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Un campo de formulario con etiqueta visible, ayuda y error.
 *
 * Reglas que el componente hace cumplir por diseño:
 *   - La etiqueta es SIEMPRE visible. Un placeholder no es una etiqueta:
 *     desaparece justo cuando la persona escribe y necesita recordar qué le
 *     pidieron.
 *   - El error va pegado al campo, no arriba de todo, y se anuncia con
 *     aria-describedby + aria-invalid para que un lector de pantalla lo lea.
 *   - El asterisco de obligatorio se acompaña de texto para quien no lo ve.
 */

const claseControl =
  "w-full rounded border bg-superficie px-3 text-[length:var(--texto-dato)] text-tinta " +
  "placeholder:text-apagado transition-colors duration-150 " +
  "disabled:cursor-not-allowed disabled:bg-papel disabled:opacity-60";

export const Campo = forwardRef(function Campo(
  {
    etiqueta,
    ayuda,
    error,
    obligatorio = false,
    className,
    id: idExterno,
    children,
    ...props
  },
  ref,
) {
  const idGenerado = useId();
  const id = idExterno ?? idGenerado;
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descritoPor = [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* El asterisco va como pseudo-elemento: se ve, pero no entra en el
          nombre accesible del campo. Lo obligatorio se anuncia con
          aria-required en el control, que es lo que los lectores de pantalla
          leen de forma nativa. */}
      <label
        htmlFor={id}
        className={cn(
          "text-sm font-medium text-tinta",
          obligatorio && "after:ml-0.5 after:text-sello after:content-['*']",
        )}
      >
        {etiqueta}
      </label>

      {children ? (
        children({
          id,
          "aria-describedby": descritoPor || undefined,
          "aria-invalid": Boolean(error),
          "aria-required": obligatorio || undefined,
        })
      ) : (
        <input
          ref={ref}
          id={id}
          aria-describedby={descritoPor || undefined}
          aria-invalid={error ? "true" : undefined}
          aria-required={obligatorio ? "true" : undefined}
          className={cn(
            claseControl,
            "h-control",
            error ? "border-sello" : "border-borde-fuerte",
          )}
          {...props}
        />
      )}

      {ayuda && !error && (
        <p id={idAyuda} className="text-sm text-apagado">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="text-sm font-medium text-sello">
          {error}
        </p>
      )}
    </div>
  );
});

/**
 * Contraseña con botón de mostrar/ocultar.
 *
 * El ojo NO es un checkbox disfrazado: es un botón que cambia el `type` del
 * input. Por eso lleva `aria-pressed` —el lector de pantalla anuncia si está
 * activado— y una etiqueta que cambia con el estado. Sin eso, quien no ve el
 * ícono no tiene forma de saber si su contraseña está a la vista.
 *
 * Queda fuera del orden de tabulación (`tabIndex={-1}`): tabulando desde la
 * contraseña querés llegar a "Ingresar", no a un control opcional. Se alcanza
 * igual con el mouse y con la navegación por elementos del lector.
 */
export const CampoContrasena = forwardRef(function CampoContrasena(
  { etiqueta = "Contraseña", ayuda, error, obligatorio, className, ...propsInput },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <Campo
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      obligatorio={obligatorio}
      className={className}
    >
      {(propsCampo) => (
        <div className="relative">
          <input
            {...propsCampo}
            {...propsInput}
            ref={ref}
            type={visible ? "text" : "password"}
            className={cn(
              claseControl,
              "h-control pr-11",
              error ? "border-sello" : "border-borde-fuerte",
            )}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className={cn(
              "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r",
              "text-apagado transition-colors duration-150 hover:text-expediente",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
              "focus-visible:outline-expediente",
            )}
          >
            {visible ? (
              <EyeOff className="size-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="size-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </Campo>
  );
});

/**
 * Desplegable.
 *
 * Era un `<select>` nativo. El nativo es impecable en accesibilidad, pero el
 * panel lo dibuja el sistema operativo: no se puede alinear con el control del
 * que sale ni usar los colores del sistema. Por eso ahora es Radix Select, que
 * da lo mismo en teclado y lectores de pantalla y además deja estilar el panel.
 *
 * El panel se ancla al control con `--radix-select-trigger-width`: sale
 * exactamente del ancho del campo, no de un ancho propio.
 *
 * La firma es la del `<select>` que reemplazó —`value` y un `onChange` que
 * recibe `{target:{value}}`— así los diez lugares que lo usan no cambian.
 */

/* Radix reserva la cadena vacía para "sin valor" y prohíbe un Item con
   `value=""`. Pero varios filtros usan "" como opción de verdad ("Todos"),
   que tiene que poder volver a elegirse. El centinela le da un valor real al
   item y la traducción queda acá adentro, invisible para el llamador. */
const SIN_VALOR = "__sin_valor__";

export const Selector = forwardRef(function Selector(
  { opciones = [], placeholder, className, error, value, onChange, disabled, ...props },
  ref,
) {
  const valorInterno = value === "" || value == null ? SIN_VALOR : String(value);

  return (
    <Select.Root
      value={valorInterno}
      onValueChange={(v) => onChange?.({ target: { value: v === SIN_VALOR ? "" : v } })}
      disabled={disabled}
    >
      <Select.Trigger
        ref={ref}
        // El `<select>` que había antes exponía su valor en el DOM. Radix no,
        // porque el disparador es un botón. Se repone acá: sirve para leer de
        // un vistazo qué está elegido cuando algo falla.
        data-valor={value ?? ""}
        className={cn(
          claseControl,
          "h-control flex items-center justify-between gap-2 text-left",
          "data-[placeholder]:text-apagado",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px]",
          "focus-visible:outline-expediente",
          error ? "border-sello" : "border-borde-fuerte",
          className,
        )}
        {...props}
      >
        {/* `block truncate` para que una etiqueta larga no ensanche el control
            ni empuje la flecha fuera del campo. */}
        <Select.Value placeholder={placeholder} className="block truncate" />
        <Select.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-apagado" aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "panel-flotante z-50 overflow-hidden rounded border border-borde-fuerte",
            "bg-superficie shadow-lg",
            // De acá sale el pedido: el panel mide lo que mide el control.
            "w-[var(--radix-select-trigger-width)]",
            "max-h-[var(--radix-select-content-available-height)]",
          )}
        >
          <Select.Viewport className="p-1">
            {placeholder && <OpcionSelector value={SIN_VALOR}>{placeholder}</OpcionSelector>}
            {opciones.map((o) => (
              <OpcionSelector key={o.valor} value={String(o.valor)}>
                {o.etiqueta}
              </OpcionSelector>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
});

function OpcionSelector({ value, children }) {
  return (
    <Select.Item
      value={value}
      // El `<option>` que había antes exponía su valor en el DOM y las pruebas
      // elegían por valor, no por el texto que se ve. Radix no lo expone, así
      // que se agrega acá: mantiene esa forma de elegir y además hace legible
      // el DOM cuando algo falla.
      data-valor={value}
      className={cn(
        "relative flex cursor-pointer select-none items-center justify-between gap-2",
        "rounded-[2px] py-2 pl-3 pr-2 text-[length:var(--texto-dato)] text-tinta outline-none",
        // Radix marca con `data-highlighted` tanto el hover como el teclado:
        // una sola regla cubre mouse y flechas.
        "data-[highlighted]:bg-expediente-suave data-[highlighted]:text-expediente",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      )}
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator asChild>
        <Check className="size-4 shrink-0 text-expediente" aria-hidden="true" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

export const AreaTexto = forwardRef(function AreaTexto({ className, error, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={4}
      className={cn(
        claseControl,
        "py-2 leading-relaxed",
        error ? "border-sello" : "border-borde-fuerte",
        className,
      )}
      {...props}
    />
  );
});

export { claseControl };
