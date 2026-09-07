import { useState } from "react";
import { mensajeAmable } from "@/lib/api/cliente";
import { Button } from "./ui/button";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "./ui/dialog";

/**
 * Confirmación para las acciones que no se deshacen.
 *
 * El diálogo nombra lo que va a pasar en vez de preguntar "¿Estás seguro?", que
 * no le dice nada a nadie. Y el botón repite el verbo de la acción: si el
 * disparador dice "Eliminar", el que confirma también.
 */
export function ConfirmarAccion({
  titulo,
  descripcion,
  textoConfirmar = "Confirmar",
  destructivo = true,
  alConfirmar,
  disparador,
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      await alConfirmar();
      setAbierto(false);
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
        if (!v) setError(null);
      }}
    >
      <DisparadorDialogo asChild>{disparador}</DisparadorDialogo>

      <ContenidoDialogo titulo={titulo} descripcion={descripcion}>
        {error && (
          <p
            role="alert"
            className="mb-u2 rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
          >
            {mensajeAmable(error)}
          </p>
        )}

        <div className="mt-u2 flex justify-end gap-u2">
          <CerrarDialogo asChild>
            <Button variante="secundario">Cancelar</Button>
          </CerrarDialogo>
          <Button
            variante={destructivo ? "destructivo" : "primario"}
            disabled={enviando}
            onClick={confirmar}
          >
            {enviando ? "Un momento…" : textoConfirmar}
          </Button>
        </div>
      </ContenidoDialogo>
    </Dialogo>
  );
}
