import { useState } from "react";
import { resolverObra } from "@/lib/api/endpoints/expedientes";
import { mensajeAmable } from "@/lib/api/cliente";
import { Button } from "@/componentes/ui/button";
import { AreaTexto, Campo } from "@/componentes/ui/campo";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";

export function ResolucionObra({ expediente, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState("");
  const [resumen, setResumen] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (expediente.resolucionObra) {
    return (
      <section className="mt-u3 rounded border border-borde bg-superficie p-u3">
        <h2>Resolución administrativa: {expediente.resolucionObra === "approved" ? "aprobada" : "rechazada"}</h2>
        <p className="mt-u2 whitespace-pre-line">{expediente.resumenResolucionObra}</p>
      </section>
    );
  }
  if (expediente.estado !== "EN_TRAMITE") return null;

  async function enviar(evento) {
    evento.preventDefault();
    if (!resultado || !resumen.trim()) {
      setError("Elegí el resultado y escribí el resumen del dictamen.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await resolverObra(expediente.expedienteId, { resultado, resumen: resumen.trim() });
      setAbierto(false);
      alGuardar();
    } catch (e) {
      setError(mensajeAmable(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo open={abierto} onOpenChange={(v) => { if (!enviando) { setAbierto(v); setError(null); } }}>
      <DisparadorDialogo asChild><Button className="mt-u3">Resolver expediente de obra</Button></DisparadorDialogo>
      <ContenidoDialogo titulo="Resolver expediente de obra" descripcion="Registrá el dictamen administrativo efectivo. El resultado se comunicará a Obras Públicas.">
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          <fieldset disabled={enviando}>
            <legend className="mb-u1 font-medium">Resultado del dictamen</legend>
            {[['approved', 'Aprobado'], ['rejected', 'Rechazado']].map(([valor, etiqueta]) => (
              <label key={valor} className="mr-u3 inline-flex items-center gap-2">
                <input type="radio" name="resultado-obra" value={valor} checked={resultado === valor} onChange={() => setResultado(valor)} />
                {etiqueta}
              </label>
            ))}
          </fieldset>
          <Campo etiqueta="Resumen del dictamen" obligatorio ayuda="Este resumen se comparte con Obras Públicas. Incluí solo información necesaria para la resolución.">
            {(props) => <AreaTexto {...props} value={resumen} maxLength={4000} disabled={enviando} onChange={(e) => setResumen(e.target.value)} />}
          </Campo>
          {error && <p role="alert" className="text-sello">{error}</p>}
          <div className="mt-u2 flex justify-end gap-u2">
            <CerrarDialogo asChild><Button type="button" variante="secundario" disabled={enviando}>Cancelar</Button></CerrarDialogo>
            <Button type="submit" disabled={enviando}>{enviando ? "Registrando…" : "Registrar resolución"}</Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}
