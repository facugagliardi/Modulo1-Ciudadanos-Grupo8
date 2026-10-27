import { AlertTriangle, Inbox, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { mensajeAmable } from "@/lib/api/cliente";
import { Button } from "./ui/button";

export function ErrorEnPantalla({ error, alReintentar, className }) {
  return (
    <div className={cn("flex flex-col items-center gap-u2 py-u5 text-center", className)} role="alert">
      <AlertTriangle className="size-6 text-sello" aria-hidden="true" />
      <p className="max-w-prose font-medium text-tinta">{mensajeAmable(error)}</p>
      {alReintentar && (
        <Button variante="secundario" tamano="chico" onClick={alReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Una pantalla vacía es una invitación a hacer algo, no un cartel de error. */
export function EstadoVacio({ titulo, descripcion, accion, className }) {
  return (
    <div className={cn("flex flex-col items-center gap-u2 py-u5 text-center", className)}>
      <Inbox className="size-6 text-apagado" aria-hidden="true" />
      <p className="font-medium text-tinta">{titulo}</p>
      {descripcion && <p className="max-w-prose text-sm text-apagado">{descripcion}</p>}
      {accion}
    </div>
  );
}

export function SinResultados({ termino, alLimpiar, className }) {
  return (
    <div className={cn("flex flex-col items-center gap-u2 py-u5 text-center", className)}>
      <SearchX className="size-6 text-apagado" aria-hidden="true" />
      <p className="font-medium text-tinta">
        No encontramos resultados para “{termino}”
      </p>
      <p className="text-sm text-apagado">Probá con menos palabras o revisá los filtros.</p>
      {alLimpiar && (
        <Button variante="secundario" tamano="chico" onClick={alLimpiar}>
          Limpiar búsqueda
        </Button>
      )}
    </div>
  );
}
