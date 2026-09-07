import { cn } from "@/lib/utils";

/**
 * Encabezado de pantalla.
 *
 * El "seccion" de arriba no es decoración: nombra en qué registro estás
 * parado. En un sistema donde las mismas acciones existen sobre ciudadanos,
 * organizaciones y expedientes, saber sobre qué libro estás escribiendo es
 * lo que evita cargar el dato en el lugar equivocado.
 */
export function Encabezado({ seccion, titulo, descripcion, acciones, className }) {
  return (
    <header className={cn("mb-u3 flex flex-wrap items-start justify-between gap-u2", className)}>
      <div className="min-w-0">
        {seccion && (
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-apagado">
            {seccion}
          </p>
        )}
        <h1>{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-prose text-apagado">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-u2">{acciones}</div>}
    </header>
  );
}
