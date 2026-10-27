import * as Primitiva from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { BarraDeGoma, useBarraDeGoma } from "@/componentes/BarraDeGoma";

export const Pestanias = Primitiva.Root;

/** La pestaña activa la marca una sola barra que viaja entre ellas (`BarraDeGoma`). */
export function ListaPestanias({ className, children, ...props }) {
  const { lista, barra } = useBarraDeGoma("x");
  return (
    <Primitiva.List
      ref={lista}
      className={cn("relative -mb-px flex gap-u3 overflow-x-auto border-b border-borde", className)}
      {...props}
    >
      {children}
      <BarraDeGoma refBarra={barra} />
    </Primitiva.List>
  );
}

/* Todas en negrita, como en la fila del portal: si sólo la activa lo fuera,
   cambiaría de ancho y correría a las de al lado. La marcan el color y la barra. */
export function Pestania({ className, ...props }) {
  return (
    <Primitiva.Trigger
      className={cn(
        "whitespace-nowrap px-0.5 py-2.5 text-[length:var(--texto-dato)] font-semibold text-apagado",
        "transition-colors duration-[400ms] ease-[var(--ease-morph)] hover:text-tinta",
        "data-[state=active]:text-expediente",
        className,
      )}
      {...props}
    />
  );
}

/**
 * El número al lado del nombre de una pestaña ("Domicilios 2"). Mientras no
 * llegó (`valor` en `null`), ocupa su lugar sin verse y aparece con un fundido:
 * si apareciera de golpe, la pestaña se ensancharía y correría a las de al lado
 * —y a la barra— justo cuando termina de cargar.
 */
export function ContadorDePestania({ valor }) {
  const falta = valor == null;
  return (
    <span
      aria-hidden={falta || undefined}
      className={cn(
        "ml-1.5 text-apagado transition-opacity duration-[var(--dur-3)] ease-[var(--ease-salida)]",
        falta && "opacity-0",
      )}
    >
      {valor ?? 0}
    </span>
  );
}

export function PanelPestania({ className, ...props }) {
  return <Primitiva.Content className={cn("pt-u3", className)} {...props} />;
}
