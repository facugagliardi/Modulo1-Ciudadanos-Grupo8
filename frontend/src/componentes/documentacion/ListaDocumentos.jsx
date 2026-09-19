import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  revisarArchivo,
  subirDocumento,
  subirVersion,
  validarDocumento,
} from "@/lib/api/endpoints/documentacion";
import { mensajeAmable } from "@/lib/api/cliente";
import { formatearAutor, formatearFecha } from "@/lib/dominio/formato";
import { ARCHIVOS_PERMITIDOS, etiquetaDe, TIPOS_DOCUMENTO } from "@/lib/dominio/listasBlancas";
import { EstadoVacio } from "@/componentes/Estados";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { Card, CardCuerpo } from "@/componentes/ui/card";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";

/**
 * La documentación de una persona. La usan el portal y el legajo del
 * backoffice; lo que cambia es quién puede validar.
 *
 * DOS LÍMITES DEL BACKEND QUE SE VEN ACÁ:
 *
 * 1. No hay endpoint de descarga. `urlArchivo` es un `file://` del disco del
 *    servidor, así que el archivo NO se puede abrir desde el navegador. Se
 *    muestra como referencia, no como enlace: prometer una descarga que falla
 *    es peor que no ofrecerla.
 * 2. El versionado pisa la fila. Sube el número de versión pero no hay forma
 *    de consultar las anteriores, así que la pantalla no promete un historial
 *    que no existe.
 */

const RESULTADO = {
  VALIDADO: { texto: "Validado", clase: "bg-vigente-suave text-vigente" },
  RECHAZADO: { texto: "Rechazado", clase: "bg-sello-suave text-sello" },
  PENDIENTE: { texto: "Sin validar", clase: "bg-alerta-suave text-alerta" },
};

export function ListaDocumentos({
  personaId,
  documentos,
  puedeSubir = false,
  puedeValidar = false,
  alCambiar,
  vacio,
}) {
  if (documentos.length === 0) {
    return (
      <Card>
        <CardCuerpo>
          <EstadoVacio
            titulo={vacio?.titulo ?? "No hay documentación cargada"}
            descripcion={vacio?.descripcion}
            accion={
              puedeSubir && (
                <SubirDocumento personaId={personaId} alGuardar={alCambiar}>
                  <Button>Subir el primero</Button>
                </SubirDocumento>
              )
            }
          />
        </CardCuerpo>
      </Card>
    );
  }

  return (
    <ul className="lista-escalonada flex flex-col gap-u2">
      {documentos.map((d) => {
        const estado = RESULTADO[d.resultadoValidacion] ?? RESULTADO.PENDIENTE;
        const vencido = d.vigenciaHasta && d.vigenciaHasta < new Date().toISOString().slice(0, 10);
        return (
          <li key={d.documentoId}>
            <Card>
              <CardCuerpo className="flex flex-wrap items-start justify-between gap-u2">
                <div className="flex min-w-0 gap-u2">
                  <FileText className="mt-0.5 size-5 shrink-0 text-apagado" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-u2 font-medium">
                      {etiquetaDe(TIPOS_DOCUMENTO, d.tipoDocumento)}
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-semibold",
                          estado.clase,
                        )}
                      >
                        {estado.texto}
                      </span>
                      {d.version > 1 && (
                        <span className="identificador text-xs text-apagado">v{d.version}</span>
                      )}
                    </p>
                    <p className="text-[length:var(--texto-dato)] text-apagado">
                      {d.vigenciaHasta ? (
                        <span className={cn(vencido && "font-medium text-sello")}>
                          {vencido ? "Venció el" : "Vigente hasta el"}{" "}
                          {formatearFecha(d.vigenciaHasta)}
                        </span>
                      ) : (
                        "Sin fecha de vencimiento"
                      )}
                      {d.validadoPor && ` · ${formatearAutor(d.validadoPor)}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-u2">
                  {puedeSubir && (
                    <SubirDocumento documento={d} alGuardar={alCambiar}>
                      <Button variante="secundario" tamano="chico">
                        Subir nueva versión
                      </Button>
                    </SubirDocumento>
                  )}
                  {puedeValidar && d.resultadoValidacion === "PENDIENTE" && (
                    <ValidarDocumento documento={d} alGuardar={alCambiar} />
                  )}
                </div>
              </CardCuerpo>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Alta de documento y nueva versión: el mismo diálogo, porque para la persona
 * es la misma acción. Si viene `documento`, sube una versión (y entonces el
 * tipo ya está fijado y no se elige).
 */
export function SubirDocumento({ personaId, documento, alGuardar, children }) {
  const esVersion = Boolean(documento);
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState("DNI");
  const [archivo, setArchivo] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function elegir(evento) {
    const f = evento.target.files?.[0] ?? null;
    setArchivo(f);
    // Se revisa acá y no al enviar: esperar toda la subida para recibir un 413
    // es la peor forma de enterarse.
    setErrorArchivo(f ? revisarArchivo(f) : null);
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    const problema = revisarArchivo(archivo);
    if (problema) {
      setErrorArchivo(problema);
      return;
    }
    setEnviando(true);
    try {
      if (esVersion) await subirVersion(documento.documentoId, archivo);
      else await subirDocumento(personaId, { archivo, tipoDocumento: tipo });
      alGuardar?.();
      setAbierto(false);
      setArchivo(null);
    } catch (error) {
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
          setArchivo(null);
          setErrorArchivo(null);
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>{children}</DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo={esVersion ? "Subir nueva versión" : "Subir documento"}
        descripcion={
          esVersion
            ? `Reemplaza la versión ${documento.version} de ${etiquetaDe(TIPOS_DOCUMENTO, documento.tipoDocumento)}. Vuelve a quedar sin validar.`
            : "PDF o imagen, hasta 10 MB."
        }
      >
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          {!esVersion && (
            <Campo etiqueta="Tipo de documento" obligatorio>
              {(props) => (
                <Selector
                  {...props}
                  opciones={TIPOS_DOCUMENTO}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                />
              )}
            </Campo>
          )}

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
              <Upload aria-hidden="true" />
              {enviando ? "Subiendo…" : esVersion ? "Subir versión" : "Subir documento"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}

/** Aprobar o rechazar. Exige el permiso VALIDAR_DOCUMENTACION. */
function ValidarDocumento({ documento, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [aprobado, setAprobado] = useState(true);
  const [vigenciaHasta, setVigencia] = useState("");
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const hoy = new Date().toISOString().slice(0, 10);

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    setEnviando(true);
    try {
      await validarDocumento(documento.documentoId, {
        aprobado,
        // El backend rechaza una vigencia pasada, y sólo la aplica si se aprueba.
        vigenciaHasta: aprobado && vigenciaHasta ? vigenciaHasta : undefined,
      });
      alGuardar?.();
      setAbierto(false);
    } catch (e) {
      setErrorGeneral(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo open={abierto} onOpenChange={setAbierto}>
      <DisparadorDialogo asChild>
        <Button tamano="chico">Validar</Button>
      </DisparadorDialogo>

      <ContenidoDialogo
        titulo="Validar documentación"
        descripcion={`${etiquetaDe(TIPOS_DOCUMENTO, documento.tipoDocumento)}, versión ${documento.version}. La decisión queda asentada con tu legajo y no se puede repetir.`}
      >
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium text-tinta">Resultado</legend>
            {[
              [true, "Aprobar", "El documento sirve y queda validado."],
              [false, "Rechazar", "No sirve. El titular va a tener que subir otro."],
            ].map(([valor, titulo, detalle]) => (
              <label
                key={titulo}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded border p-2.5 transition-colors duration-150",
                  aprobado === valor
                    ? valor
                      ? "border-vigente bg-vigente-suave"
                      : "border-sello bg-sello-suave"
                    : "border-borde-fuerte hover:bg-papel",
                )}
              >
                <input
                  type="radio"
                  name="resultado"
                  checked={aprobado === valor}
                  onChange={() => setAprobado(valor)}
                  className="mt-0.5 size-4 accent-[color:var(--expediente)]"
                />
                <span>
                  <span className="font-medium text-tinta">{titulo}</span>
                  <span className="block text-sm text-apagado">{detalle}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {aprobado && (
            <Campo
              etiqueta="Vigente hasta"
              type="date"
              min={hoy}
              ayuda="Opcional. Dejalo vacío si el documento no vence."
              value={vigenciaHasta}
              onChange={(e) => setVigencia(e.target.value)}
            />
          )}

          {errorGeneral && (
            <p
              role="alert"
              className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
            >
              {errorGeneral.status === 409
                ? "Este documento ya fue validado por alguien más."
                : mensajeAmable(errorGeneral)}
            </p>
          )}

          <div className="mt-u1 flex justify-end gap-u2">
            <CerrarDialogo asChild>
              <Button type="button" variante="secundario">
                Cancelar
              </Button>
            </CerrarDialogo>
            <Button type="submit" variante={aprobado ? "primario" : "destructivo"} disabled={enviando}>
              {enviando ? "Guardando…" : aprobado ? "Aprobar documento" : "Rechazar documento"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}
