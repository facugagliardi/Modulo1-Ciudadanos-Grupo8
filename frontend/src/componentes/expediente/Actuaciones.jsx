import { useState } from "react";
import { Paperclip, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { crearActuacion } from "@/lib/api/endpoints/expedientes";
import { mensajeAmable } from "@/lib/api/cliente";
import { formatearFechaHora } from "@/lib/dominio/formato";
import { etiquetaDe, TIPOS_ACTUACION } from "@/lib/dominio/listasBlancas";
import { EstadoVacio } from "@/componentes/Estados";
import { Button } from "@/componentes/ui/button";
import { AreaTexto, Campo, Selector } from "@/componentes/ui/campo";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";

/**
 * Las actuaciones de un expediente, como fojas numeradas.
 *
 * La numeración 01 / 02 / 03 es un dato del dominio, no un adorno: el backend
 * devuelve `actuacionId` como un contador **por expediente**, así que el número
 * de foja es literalmente el que tiene esa actuación dentro de este expediente.
 * Por eso también la clave de React es el par expediente+actuación: el id solo
 * se repite entre expedientes distintos.
 *
 * Es la historia completa del trámite, que es lo que el módulo promete
 * garantizar: quién hizo qué, cuándo y desde qué área.
 */
export function Actuaciones({ expedienteId, actuaciones, estadoExpediente, puedeAgregar, alAgregar }) {
  // El backend responde 409 si el expediente está archivado.
  const archivado = estadoExpediente === "ARCHIVADO";

  return (
    <section className="mt-u4">
      <header className="mb-u3 flex flex-wrap items-center justify-between gap-u2">
        <div>
          <h2>Actuaciones</h2>
          <p className="text-[length:var(--texto-dato)] text-apagado">
            Todo lo que las áreas registraron sobre este expediente, en orden.
          </p>
        </div>

        {puedeAgregar &&
          (archivado ? (
            <p className="max-w-xs text-right text-sm text-apagado">
              El expediente está archivado: no admite nuevas actuaciones.
            </p>
          ) : (
            <FormularioActuacion expedienteId={expedienteId} alGuardar={alAgregar}>
              <Button>
                <Plus aria-hidden="true" />
                Registrar actuación
              </Button>
            </FormularioActuacion>
          ))}
      </header>

      {actuaciones.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay actuaciones"
          descripcion="Cuando un área intervenga sobre este expediente, va a quedar registrado acá."
        />
      ) : (
        <ol className="lista-escalonada flex flex-col">
          {actuaciones.map((a, i) => (
            <li
              key={`${a.expedienteId ?? expedienteId}-${a.actuacionId}`}
              className={cn(
                "flex gap-u3 border-l-2 border-borde py-u3 pl-u3",
                i === 0 && "pt-0",
                i === actuaciones.length - 1 && "border-transparent pb-0",
              )}
            >
              {/* El número de foja: dato real, no ornamento */}
              <span
                aria-hidden="true"
                className="identificador -ml-[calc(0.75rem+1.4rem)] grid size-7 shrink-0 place-items-center self-start rounded-full border border-borde-fuerte bg-superficie text-[11px] font-semibold text-apagado"
              >
                {String(a.actuacionId).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-u2 gap-y-1">
                  <span className="font-semibold text-tinta">
                    {etiquetaDe(TIPOS_ACTUACION, a.tipo)}
                  </span>
                  <span className="text-sm text-apagado">
                    <span className="sr-only">Foja </span>
                    <span className="identificador">
                      {String(a.actuacionId).padStart(2, "0")}
                    </span>{" "}
                    · {a.moduloOrigen} · {formatearFechaHora(a.fecha)}
                  </span>
                </p>

                <p className="mt-1 max-w-prose whitespace-pre-line text-tinta">{a.descripcion}</p>

                {a.adjuntos?.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-u2">
                    {a.adjuntos.map((adj) => (
                      <li key={adj}>
                        <span className="inline-flex items-center gap-1.5 rounded bg-papel px-2 py-1 text-sm text-apagado">
                          <Paperclip className="size-3.5" aria-hidden="true" />
                          <span className="max-w-[18rem] truncate">{adj}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FormularioActuacion({ expedienteId, alGuardar, children }) {
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState({
    tipo: "PASE",
    descripcion: "",
    moduloOrigen: "M1",
    adjuntos: "",
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);

    const e = {};
    if (!valores.descripcion.trim()) e.descripcion = "Contá qué se hizo.";
    if (!valores.moduloOrigen.trim()) e.moduloOrigen = "Indicá el área o módulo.";
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      await crearActuacion(expedienteId, {
        tipo: valores.tipo,
        descripcion: valores.descripcion.trim(),
        moduloOrigen: valores.moduloOrigen.trim(),
        // Una referencia por línea. El backend guarda strings: URLs o ids externos.
        adjuntos: valores.adjuntos
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      alGuardar?.();
      setAbierto(false);
      setValores({ tipo: "PASE", descripcion: "", moduloOrigen: "M1", adjuntos: "" });
    } catch (error) {
      if (error?.tieneErroresDeCampo) setErrores(error.errores);
      setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) {
          setErrores({});
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>{children}</DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo="Registrar actuación"
        descripcion="Queda asentada en el expediente con la fecha y el área. No se puede borrar."
      >
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          <Campo etiqueta="Tipo de actuación" obligatorio>
            {(props) => (
              <Selector
                {...props}
                opciones={TIPOS_ACTUACION}
                value={valores.tipo}
                onChange={(e) => cambiar("tipo", e.target.value)}
              />
            )}
          </Campo>

          <Campo
            etiqueta="Descripción"
            obligatorio
            ayuda="Qué se hizo, con el detalle que haga falta para entenderlo dentro de un año."
            error={errores.descripcion}
          >
            {(props) => (
              <AreaTexto
                {...props}
                value={valores.descripcion}
                onChange={(e) => cambiar("descripcion", e.target.value)}
                error={errores.descripcion}
              />
            )}
          </Campo>

          <Campo
            etiqueta="Área o módulo de origen"
            obligatorio
            ayuda="Quién interviene. Por ejemplo: M1, Habilitaciones, Obras."
            value={valores.moduloOrigen}
            onChange={(e) => cambiar("moduloOrigen", e.target.value)}
            error={errores.moduloOrigen}
          />

          <Campo
            etiqueta="Adjuntos"
            ayuda="Opcional. Una referencia o URL por línea."
          >
            {(props) => (
              <AreaTexto
                {...props}
                rows={2}
                value={valores.adjuntos}
                onChange={(e) => cambiar("adjuntos", e.target.value)}
              />
            )}
          </Campo>

          {errorGeneral && (
            <p
              role="alert"
              className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
            >
              {errorGeneral.status === 409
                ? "El expediente está archivado y no admite nuevas actuaciones."
                : mensajeAmable(errorGeneral)}
            </p>
          )}

          <div className="mt-u1 flex justify-end gap-u2">
            <CerrarDialogo asChild>
              <Button type="button" variante="secundario">
                Cancelar
              </Button>
            </CerrarDialogo>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Registrando…" : "Registrar actuación"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}
