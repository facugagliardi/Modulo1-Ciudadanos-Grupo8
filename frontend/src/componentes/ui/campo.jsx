import { forwardRef, useId } from "react";
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

/** Select nativo. Es totalmente accesible con teclado sin JavaScript extra. */
export const Selector = forwardRef(function Selector(
  { opciones = [], placeholder, className, error, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        claseControl,
        "h-control appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 8%22><path fill=%22%235B6472%22 d=%22M1 1l5 5 5-5%22/></svg>')]",
        error ? "border-sello" : "border-borde-fuerte",
        className,
      )}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  );
});

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
