import * as Primitiva from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Radix se ocupa de lo que es fácil hacer mal a mano: atrapar el foco dentro
 * del diálogo, devolverlo al botón que lo abrió, cerrar con Escape y marcar el
 * resto de la página como inerte para los lectores de pantalla.
 */

export const Dialogo = Primitiva.Root;
export const DisparadorDialogo = Primitiva.Trigger;
export const CerrarDialogo = Primitiva.Close;

export function ContenidoDialogo({ className, titulo, descripcion, children, ...props }) {
  return (
    <Primitiva.Portal>
      <Primitiva.Overlay className="fondo-dialogo fixed inset-0 z-40 bg-tinta/40" />
      <Primitiva.Content
        className={cn(
          // El centrado usa `translate` y la animación usa `scale`: son
          // propiedades independientes, así que no se pisan. Antes las dos
          // pasaban por `transform` y la del keyframe ganaba durante la
          // animación, lo que obligaba a repetir el centrado en cada fotograma.
          "panel-dialogo fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md",
          "rounded border border-borde bg-superficie p-u3 shadow-lg",
          className,
        )}
        style={{ translate: "-50% -50%" }}
        {...props}
      >
        <div className="mb-u2 flex items-start justify-between gap-u2">
          <div>
            <Primitiva.Title className="text-base font-semibold text-tinta">
              {titulo}
            </Primitiva.Title>
            {descripcion && (
              <Primitiva.Description className="mt-1 text-[length:var(--texto-dato)] text-apagado">
                {descripcion}
              </Primitiva.Description>
            )}
          </div>
          <Primitiva.Close
            className="-mr-1 -mt-1 rounded p-1 text-apagado hover:bg-papel hover:text-tinta"
            aria-label="Cerrar"
          >
            <X className="size-4" aria-hidden="true" />
          </Primitiva.Close>
        </div>
        {children}
      </Primitiva.Content>
    </Primitiva.Portal>
  );
}
