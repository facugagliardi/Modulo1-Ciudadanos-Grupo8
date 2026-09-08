import { useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { destinosPosibles, esTerminal, etiquetaEstado } from "@/lib/dominio/estados";
import { mensajeAmable } from "@/lib/api/cliente";
import { Button } from "./ui/button";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "./ui/dialog";
import { BadgeEstado } from "./BadgeEstado";

/**
 * Cambia el estado de cualquier entidad del sistema.
 *
 * Las opciones salen del mismo grafo de transiciones que valida el backend, así
 * que sólo se ofrece lo que va a funcionar: nunca un destino inválido y nunca
 * el estado actual (mandarlo también es 400). El usuario no puede provocar ese
 * error aunque quiera.
 *
 * Cuando el destino es terminal, el diálogo lo dice con todas las letras y el
 * botón pasa a ser destructivo. Es la única familia de acciones del sistema
 * que no se puede deshacer, y merece que se note.
 */
export function CambiarEstado({
  entidad,
  estadoActual,
  alConfirmar,
  nombreEntidad = "el registro",
  disparador,
  /**
   * Destinos que el grafo permite pero una regla de negocio no. Mapa
   * `{ESTADO: "motivo"}`; se muestran deshabilitados con su explicación.
   *
   * Existe porque hay reglas del alcance que el backend todavía no valida —
   * por ejemplo, que un expediente no pase a RESUELTO sin ninguna actuación.
   * Dejar elegir algo que después va a fallar, o peor, que va a pasar cuando
   * no debería, es peor que no ofrecerlo.
   */
  destinosBloqueados = {},
}) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const destinos = destinosPosibles(entidad, estadoActual);
  const destinoEsTerminal = elegido ? esTerminal(entidad, elegido) : false;

  if (destinos.length === 0) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-apagado">
        <Lock className="size-3.5" aria-hidden="true" />
        Estado final: ya no admite cambios
      </p>
    );
  }

  async function confirmar() {
    if (!elegido) return;
    setEnviando(true);
    setError(null);
    try {
      await alConfirmar(elegido);
      setAbierto(false);
      setElegido(null);
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) {
          setElegido(null);
          setError(null);
        }
      }}
    >
      <DisparadorDialogo asChild>
        {disparador ?? (
          <Button variante="secundario" tamano="chico">
            Cambiar estado
          </Button>
        )}
      </DisparadorDialogo>

      <ContenidoDialogo
        titulo="Cambiar estado"
        descripcion={`Elegí el nuevo estado para ${nombreEntidad}.`}
      >
        <p className="mb-u2 flex items-center gap-2 text-[length:var(--texto-dato)] text-apagado">
          Estado actual: <BadgeEstado entidad={entidad} estado={estadoActual} />
        </p>

        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Nuevo estado</legend>
          {destinos.map((destino) => {
            const terminal = esTerminal(entidad, destino);
            const bloqueado = destinosBloqueados[destino];
            return (
              <label
                key={destino}
                className={cn(
                  "flex items-center gap-2.5 rounded border p-2.5 transition-colors duration-150",
                  bloqueado
                    ? "cursor-not-allowed border-borde bg-papel opacity-70"
                    : "cursor-pointer",
                  !bloqueado && elegido === destino
                    ? terminal
                      ? "border-sello bg-sello-suave"
                      : "border-expediente bg-expediente-suave"
                    : !bloqueado && "border-borde-fuerte hover:bg-papel",
                )}
              >
                <input
                  type="radio"
                  name="nuevo-estado"
                  value={destino}
                  disabled={Boolean(bloqueado)}
                  checked={elegido === destino}
                  onChange={() => setElegido(destino)}
                  className="size-4 accent-[color:var(--expediente)]"
                />
                <span className="font-medium text-tinta">{etiquetaEstado(destino)}</span>
                {bloqueado ? (
                  <span className="ml-auto text-right text-xs text-apagado">{bloqueado}</span>
                ) : (
                  terminal && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-sello">
                      <Lock className="size-3" aria-hidden="true" />
                      No se puede deshacer
                    </span>
                  )
                )}
              </label>
            );
          })}
        </fieldset>

        {destinoEsTerminal && (
          <p
            role="alert"
            className="mt-u2 rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] text-sello"
          >
            <strong className="font-semibold">{etiquetaEstado(elegido)}</strong> es un estado
            final. Una vez aplicado, {nombreEntidad} no vuelve a ningún otro estado.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-u2 rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
          >
            {mensajeAmable(error)}
          </p>
        )}

        <div className="mt-u3 flex justify-end gap-u2">
          <CerrarDialogo asChild>
            <Button variante="secundario">Cancelar</Button>
          </CerrarDialogo>
          <Button
            variante={destinoEsTerminal ? "destructivo" : "primario"}
            disabled={!elegido || enviando}
            onClick={confirmar}
          >
            {enviando ? "Aplicando…" : "Confirmar cambio"}
          </Button>
        </div>
      </ContenidoDialogo>
    </Dialogo>
  );
}
