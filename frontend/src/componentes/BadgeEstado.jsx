import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { esTerminal, etiquetaEstado, valenciaDe } from "@/lib/dominio/estados";

/**
 * El estado de una entidad, con dos informaciones separadas:
 *
 *   COLOR  = qué tan grave es (valencia).
 *   CANDADO = si es terminal, es decir, si ya no vuelve atrás.
 *
 * Van separados a propósito. Si la terminalidad se codificara en el color,
 * quien no distingue colores perdería el dato más importante de la pantalla:
 * que la acción no se puede deshacer. Además permite representar bien a
 * CUMPLIDA, que es terminal y buena a la vez.
 *
 * La terminalidad se deriva del mismo grafo de transiciones que usa el
 * backend, así que VENCIDA sale terminal en una representación y no terminal
 * en una solicitud, que es justo lo que pasa.
 */

const PORVALENCIA = {
  positiva: "bg-vigente-suave text-vigente",
  pendiente: "bg-alerta-suave text-alerta",
  grave: "bg-sello-suave text-sello",
  neutra: "bg-papel text-apagado ring-1 ring-inset ring-borde-fuerte",
};

export function BadgeEstado({ entidad, estado, className }) {
  if (!estado) return <span className="text-apagado">—</span>;

  const valencia = valenciaDe(estado);
  const terminal = entidad ? esTerminal(entidad, estado) : false;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold",
        PORVALENCIA[valencia] ?? PORVALENCIA.neutra,
        className,
      )}
    >
      {terminal && <Lock className="size-3" aria-hidden="true" />}
      {etiquetaEstado(estado)}
      {terminal && <span className="sr-only"> (estado final, no se puede revertir)</span>}
    </span>
  );
}
