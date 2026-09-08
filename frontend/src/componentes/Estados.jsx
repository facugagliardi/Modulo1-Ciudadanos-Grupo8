import { AlertTriangle, Inbox, Loader2, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { mensajeAmable } from "@/lib/api/cliente";
import { Button } from "./ui/button";

/**
 * Los tres estados que toda pantalla con datos tiene que saber mostrar, más
 * uno que casi siempre se olvida: "no hay nada" y "tu búsqueda no encontró
 * nada" son cosas distintas y necesitan respuestas distintas.
 */

export function Cargando({ texto = "Cargando…", className }) {
  return (
    <div
      className={cn("flex items-center justify-center gap-2 py-u5 text-apagado", className)}
      role="status"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

/** Filas fantasma: mantienen el alto de la tabla y evitan que la página salte. */
export function FilasFantasma({ columnas, filas = 8 }) {
  return Array.from({ length: filas }).map((_, i) => (
    <tr key={i} className="border-b border-borde">
      {Array.from({ length: columnas }).map((__, j) => (
        <td key={j} className="h-fila px-u3">
          <div className="h-3 w-3/4 animate-pulse rounded bg-borde" />
        </td>
      ))}
    </tr>
  ));
}

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
