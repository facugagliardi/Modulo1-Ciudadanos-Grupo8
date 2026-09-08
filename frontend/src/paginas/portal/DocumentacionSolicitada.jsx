import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  cambiarEstadoSolicitud,
  listarSolicitudes,
  revisarArchivo,
  subirDocumento,
} from "@/lib/api/endpoints/documentacion";
import { listarDocumentos } from "@/lib/api/endpoints/personas";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { mensajeAmable } from "@/lib/api/cliente";
import { diasHasta, formatearFecha } from "@/lib/dominio/formato";
import { ARCHIVOS_PERMITIDOS, etiquetaDe, TIPOS_DOCUMENTO } from "@/lib/dominio/listasBlancas";
import { Cargando, ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { Card, CardCuerpo } from "@/componentes/ui/card";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";

/**
 * Lo que el municipio le pide al vecino.
 *
 * Es la pantalla con el flujo más delicado del sistema. Para cumplir una
 * solicitud hacen falta DOS pedidos al backend:
 *
 *   1. POST /personas/{id}/documentos  → devuelve el documentoId
 *   2. PATCH /solicitudes-documentacion/{id}/estado con CUMPLIDA + ese documentoId
 *
 * Para la persona tiene que ser una sola acción: elige el archivo y listo. Si
 * el segundo pedido falla, el documento igual quedó subido, así que la pantalla
 * lo dice y ofrece asociarlo sin volver a subir nada.
 */
export function DocumentacionSolicitada() {
  const { id } = useSesion();
  const solicitudes = useRecurso(useCallback((s) => listarSolicitudes(s), []));

  const lista = solicitudes.datos ?? [];
  const pendientes = lista.filter((s) => s.estado !== "CUMPLIDA");
  const cumplidas = lista.filter((s) => s.estado === "CUMPLIDA");

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo="Documentación que te piden"
        descripcion="Cuando el municipio necesita un papel tuyo para seguir con un trámite, aparece acá."
      />

      {solicitudes.cargando && <Cargando />}
      {solicitudes.error && (
        <ErrorEnPantalla error={solicitudes.error} alReintentar={solicitudes.recargar} />
      )}

      {solicitudes.datos && pendientes.length === 0 && cumplidas.length === 0 && (
        <Card>
          <CardCuerpo>
            <EstadoVacio
              titulo="No te están pidiendo nada"
              descripcion="Si el municipio necesita algún documento tuyo, te va a aparecer en esta pantalla."
            />
          </CardCuerpo>
        </Card>
      )}

      {pendientes.length > 0 && (
        <ul className="lista-escalonada flex flex-col gap-u2">
          {pendientes.map((s) => (
            <li key={s.solicitudId}>
              <Solicitud solicitud={s} personaId={id} alCumplir={() => solicitudes.recargar()} />
            </li>
          ))}
        </ul>
      )}

      {cumplidas.length > 0 && (
        <section className="mt-u4">
          <h2 className="mb-u2">Ya entregadas</h2>
          <ul className="flex flex-col gap-u1">
            {cumplidas.map((s) => (
              <li
                key={s.solicitudId}
                className="flex flex-wrap items-center gap-u2 rounded border border-borde bg-superficie px-u3 py-u2"
              >
                <CheckCircle2 className="size-4 shrink-0 text-vigente" aria-hidden="true" />
                <span className="font-medium">
                  {etiquetaDe(TIPOS_DOCUMENTO, s.tipoDocumento)}
                </span>
                <span className="text-[length:var(--texto-dato)] text-apagado">
                  entregada
                  {s.documentoId && (
                    <>
                      {" "}
                      · documento <span className="identificador">#{s.documentoId}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Solicitud({ solicitud, personaId, alCumplir }) {
  const dias = diasHasta(solicitud.plazo);
  const vencida = dias !== null && dias < 0;
  const urgente = dias !== null && dias >= 0 && dias <= 3;

  return (
    <Card className={cn(vencida && "border-sello")}>
      <CardCuerpo className="flex flex-wrap items-center justify-between gap-u2">
        <div className="flex min-w-0 items-start gap-u2">
          {vencida && (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-sello" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="font-medium">{etiquetaDe(TIPOS_DOCUMENTO, solicitud.tipoDocumento)}</p>
            <p
              className={cn(
                "text-[length:var(--texto-dato)]",
                vencida ? "font-medium text-sello" : urgente ? "font-medium text-alerta" : "text-apagado",
              )}
            >
              {vencida
                ? `Venció el ${formatearFecha(solicitud.plazo)}. Entregalo igual: todavía lo podés cumplir.`
                : dias === 0
                  ? "Vence hoy"
                  : `Tenés hasta el ${formatearFecha(solicitud.plazo)} · ${dias} ${dias === 1 ? "día" : "días"}`}
            </p>
          </div>
        </div>

        <EntregarDocumento solicitud={solicitud} personaId={personaId} alCumplir={alCumplir} />
      </CardCuerpo>
    </Card>
  );
}

/**
 * El encadenado: subir y asociar. Si el paso 2 falla, no se pierde el paso 1.
 */
function EntregarDocumento({ solicitud, personaId, alCumplir }) {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // Si el documento se subió pero la asociación falló, queda acá para
  // reintentar sin volver a subir el archivo.
  const [documentoHuerfano, setDocumentoHuerfano] = useState(null);

  // Documentos ya cargados: quizá el papel ya está y sólo falta asociarlo.
  const documentos = useRecurso(
    useCallback(
      (s) => (abierto ? listarDocumentos(personaId, s) : Promise.resolve([])),
      [abierto, personaId],
    ),
  );
  const [documentoExistente, setDocumentoExistente] = useState("");

  function elegir(evento) {
    const f = evento.target.files?.[0] ?? null;
    setArchivo(f);
    setErrorArchivo(f ? revisarArchivo(f) : null);
  }

  async function entregar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);

    // Camino corto: ya hay un documento cargado y sólo falta asociarlo.
    if (documentoExistente) {
      setEnviando(true);
      try {
        await cambiarEstadoSolicitud(solicitud.solicitudId, {
          estado: "CUMPLIDA",
          documentoId: Number(documentoExistente),
        });
        alCumplir?.();
        setAbierto(false);
      } catch (e) {
        setErrorGeneral(e);
      } finally {
        setEnviando(false);
      }
      return;
    }

    let documentoId = documentoHuerfano;

    if (!documentoId) {
      const problema = revisarArchivo(archivo);
      if (problema) {
        setErrorArchivo(problema);
        return;
      }
      setEnviando(true);
      try {
        const creado = await subirDocumento(personaId, {
          archivo,
          tipoDocumento: solicitud.tipoDocumento,
        });
        documentoId = creado.documentoId;
        setDocumentoHuerfano(documentoId);
      } catch (e) {
        setErrorGeneral(e);
        setEnviando(false);
        return;
      }
    } else {
      setEnviando(true);
    }

    try {
      await cambiarEstadoSolicitud(solicitud.solicitudId, {
        estado: "CUMPLIDA",
        documentoId,
      });
      alCumplir?.();
      setAbierto(false);
      setDocumentoHuerfano(null);
      setArchivo(null);
    } catch (e) {
      setErrorGeneral(e);
    } finally {
      setEnviando(false);
    }
  }

  const yaSubido = Boolean(documentoHuerfano);

  return (
    <Dialogo
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) {
          setArchivo(null);
          setErrorArchivo(null);
          setErrorGeneral(null);
          setDocumentoExistente("");
        }
      }}
    >
      <DisparadorDialogo asChild>
        <Button>
          <Upload aria-hidden="true" />
          Entregar
        </Button>
      </DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo={`Entregar ${etiquetaDe(TIPOS_DOCUMENTO, solicitud.tipoDocumento)}`}
        descripcion="Se sube el archivo y queda asociado a lo que te pidieron."
      >
        <form onSubmit={entregar} noValidate className="flex flex-col gap-u2">
          {yaSubido && (
            <p
              role="alert"
              className="rounded border border-alerta bg-alerta-suave px-3 py-2 text-[length:var(--texto-dato)] text-alerta"
            >
              El archivo ya se subió (documento{" "}
              <span className="identificador">#{documentoHuerfano}</span>), pero no pudimos
              asociarlo a la solicitud. Probá de nuevo: no hace falta volver a subirlo.
            </p>
          )}

          {!yaSubido && documentos.datos?.length > 0 && (
            <Campo
              etiqueta="¿Ya lo tenías subido?"
              ayuda="Si el documento ya está en tus documentos, elegilo y no hace falta subir nada."
            >
              {(props) => (
                <Selector
                  {...props}
                  placeholder="Subir un archivo nuevo"
                  opciones={documentos.datos.map((d) => ({
                    valor: String(d.documentoId),
                    etiqueta: `${etiquetaDe(TIPOS_DOCUMENTO, d.tipoDocumento)} · v${d.version}`,
                  }))}
                  value={documentoExistente}
                  onChange={(e) => setDocumentoExistente(e.target.value)}
                />
              )}
            </Campo>
          )}

          {!yaSubido && !documentoExistente && (
            <Campo
              etiqueta="Archivo"
              obligatorio
              type="file"
              accept={ARCHIVOS_PERMITIDOS.extensiones.join(",")}
              onChange={elegir}
              ayuda={`Se aceptan ${ARCHIVOS_PERMITIDOS.extensiones.join(", ")}. Máximo 10 MB.`}
              error={errorArchivo}
              className="[&_input]:h-auto [&_input]:py-2 [&_input]:file:mr-3 [&_input]:file:rounded [&_input]:file:border-0 [&_input]:file:bg-papel [&_input]:file:px-3 [&_input]:file:py-1 [&_input]:file:text-tinta"
            />
          )}

          {errorGeneral && (
            <p
              role="alert"
              className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
            >
              {errorGeneral.status === 413
                ? "El archivo no puede superar los 10 MB."
                : mensajeAmable(errorGeneral)}
            </p>
          )}

          <div className="mt-u1 flex justify-end gap-u2">
            <CerrarDialogo asChild>
              <Button type="button" variante="secundario">
                Cancelar
              </Button>
            </CerrarDialogo>
            <Button type="submit" disabled={enviando || Boolean(errorArchivo)}>
              {enviando ? "Entregando…" : yaSubido ? "Reintentar" : "Entregar documento"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}
