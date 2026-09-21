import { useState } from "react";
import { Eye, FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  crearSolicitud,
  obtenerDocumento,
  revisarArchivo,
  subirDocumento,
  subirVersion,
  validarDocumento,
} from "@/lib/api/endpoints/documentacion";
import { VisorDocumento } from "./VisorDocumento";
import { mensajeAmable } from "@/lib/api/cliente";
import { formatearAutor, formatearFecha } from "@/lib/dominio/formato";
import { ARCHIVOS_PERMITIDOS, etiquetaDe, TIPOS_DOCUMENTO } from "@/lib/dominio/listasBlancas";
import { EstadoVacio } from "@/componentes/Estados";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { CampoFecha, hoyISO, sumarDiasISO } from "@/componentes/ui/fecha";
import { Card, CardCuerpo } from "@/componentes/ui/card";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";

/**
 * La documentación de una persona. La usan el portal y el legajo del
 * backoffice; lo que cambia es quién puede validar.
 *
 * El archivo se abre desde acá, con `GET /documentos/{id}/archivo`. Antes no se
 * podía: la base guarda un `file://` del disco del servidor y no había endpoint
 * que devolviera el binario, así que quien validaba decidía a ciegas.
 *
 * LÍMITE DEL BACKEND QUE SE SIGUE VIENDO ACÁ: el versionado pisa la fila. Sube
 * el número de versión pero no hay forma de consultar las anteriores, así que
 * la pantalla no promete un historial que no existe — los archivos viejos
 * quedan en disco, pero nadie sabe pedirlos.
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
                  <RevisarDocumento
                    personaId={personaId}
                    documento={d}
                    alGuardar={alCambiar}
                    puedeValidar={puedeValidar}
                  />
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

const DECISIONES = [
  {
    valor: "aprobar",
    titulo: "Aprobar",
    detalle: "El documento sirve y queda validado.",
    clase: "border-vigente bg-vigente-suave",
  },
  {
    valor: "rechazar",
    titulo: "Rechazar",
    detalle: "No sirve. El titular puede subir otra versión cuando quiera.",
    clase: "border-sello bg-sello-suave",
  },
  {
    valor: "repedir",
    titulo: "Volver a pedir",
    detalle: "Lo rechaza y le abre una solicitud nueva, con su plazo.",
    clase: "border-alerta bg-alerta-suave",
  },
];

/**
 * Ver el documento y resolver, en un solo lugar.
 *
 * Mirar y decidir son el mismo acto: separarlos en dos pantallas obligaba a
 * recordar lo que se acababa de ver. Por eso el archivo y la decisión conviven,
 * y el panel del documento es el que manda en el ancho.
 *
 * Sobre "Volver a pedir": no reabre la solicitud original. En el modelo,
 * CUMPLIDA es un estado terminal —ver `TransicionesEstado`— y forzar la vuelta
 * atrás seria reescribir algo que efectivamente pasó: esa solicitud SÍ se
 * cumplió, con un documento que después resultó no servir. Se crea una
 * solicitud nueva. La historia queda entera y el titular igual recibe el
 * pedido.
 *
 * Quien no puede validar igual entra acá, pero sólo a mirar: el titular no
 * tenía forma de volver a ver lo que había subido.
 */
export function RevisarDocumento({
  personaId,
  documento: dado,
  documentoId,
  alGuardar,
  puedeValidar,
  disparador,
}) {
  const [abierto, setAbierto] = useState(false);
  const [decision, setDecision] = useState("aprobar");
  const [vigenciaHasta, setVigencia] = useState("");
  const [plazo, setPlazo] = useState("");
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // Cuando se entra por el id suelto —desde la pantalla de Documentación, que
  // sólo conoce la solicitud— hay que traer el documento para saber si todavía
  // se puede decidir sobre él.
  const [traido, setTraido] = useState(null);

  const id = dado?.documentoId ?? documentoId;
  const documento = dado ?? traido;
  const titular = personaId ?? documento?.personaId;

  const manana = sumarDiasISO(hoyISO(), 1);
  const decide = puedeValidar && documento?.resultadoValidacion === "PENDIENTE";
  const tipo = documento ? etiquetaDe(TIPOS_DOCUMENTO, documento.tipoDocumento) : "Documento";

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    setErrores({});

    if (decision === "repedir" && !plazo) {
      setErrores({ plazo: "Indicá para cuándo lo necesitás." });
      return;
    }

    setEnviando(true);
    let yaSeValido = false;
    try {
      await validarDocumento(id, {
        aprobado: decision === "aprobar",
        // El backend rechaza una vigencia pasada, y sólo la aplica si se aprueba.
        vigenciaHasta: decision === "aprobar" && vigenciaHasta ? vigenciaHasta : undefined,
      });
      yaSeValido = true;

      if (decision === "repedir") {
        await crearSolicitud({
          titularId: titular,
          tipoDocumento: documento.tipoDocumento,
          plazo,
          origen: "INTERNA",
        });
      }

      alGuardar?.();
      setAbierto(false);
    } catch (e) {
      // Si el rechazo entró y falló la solicitud, el documento YA quedó
      // rechazado. Decirlo evita que alguien reintente y termine rechazando
      // dos veces o creyendo que no pasó nada.
      e.rechazoSinSolicitud = yaSeValido;
      setErrorGeneral(e);
      if (yaSeValido) alGuardar?.();
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
          setDecision("aprobar");
          setVigencia("");
          setPlazo("");
          setErrores({});
          setErrorGeneral(null);
          // Sólo hace falta si se entró por el id: quien ya tiene el documento
          // no necesita volver a pedirlo.
          if (!dado) {
            setTraido(null);
            obtenerDocumento(id)
              .then(setTraido)
              .catch(setErrorGeneral);
          }
        }
      }}
    >
      <DisparadorDialogo asChild>
        {disparador ?? (
          <Button tamano="chico" variante={decide ? "primario" : "secundario"}>
            <Eye aria-hidden="true" />
            {decide ? "Revisar" : "Ver"}
          </Button>
        )}
      </DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-5xl"
        titulo={decide ? "Revisar documentación" : tipo}
        descripcion={
          documento
            ? decide
              ? `${tipo}, versión ${documento.version}. La decisión queda asentada con tu legajo y no se puede repetir.`
              : `Versión ${documento.version}.`
            : "Abriendo el documento…"
        }
      >
        <div className={cn("grid gap-u3", decide && "md:grid-cols-[1.7fr_1fr]")}>
          <VisorDocumento documentoId={id} className="h-[60vh]" />

          {decide && (
            <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-medium text-tinta">Resultado</legend>
                {DECISIONES.map((d) => (
                  <label
                    key={d.valor}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded border p-2.5",
                      "transition-colors duration-150",
                      decision === d.valor ? d.clase : "border-borde-fuerte hover:bg-papel",
                    )}
                  >
                    <input
                      type="radio"
                      name="resultado"
                      checked={decision === d.valor}
                      onChange={() => {
                        setDecision(d.valor);
                        setErrores({});
                      }}
                      className="mt-0.5 size-4 accent-[color:var(--expediente)]"
                    />
                    <span>
                      <span className="font-medium text-tinta">{d.titulo}</span>
                      <span className="block text-sm text-apagado">{d.detalle}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {decision === "aprobar" && (
                <CampoFecha
                  etiqueta="Vigente hasta"
                  min={hoyISO()}
                  ayuda="Opcional. Dejalo vacío si el documento no vence."
                  value={vigenciaHasta}
                  onChange={(e) => setVigencia(e.target.value)}
                />
              )}

              {decision === "repedir" && (
                <CampoFecha
                  etiqueta="Nuevo plazo"
                  obligatorio
                  min={manana}
                  ayuda="Hasta cuándo tiene tiempo de volver a presentarlo."
                  value={plazo}
                  onChange={(e) => {
                    setPlazo(e.target.value);
                    setErrores({});
                  }}
                  error={errores.plazo}
                />
              )}

              {errorGeneral && (
                <p
                  role="alert"
                  className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
                >
                  {errorGeneral.rechazoSinSolicitud
                    ? "El documento quedó rechazado, pero no se pudo crear la solicitud nueva. Pedila desde Documentación."
                    : errorGeneral.status === 409
                      ? "Este documento ya fue validado por alguien más."
                      : mensajeAmable(errorGeneral)}
                </p>
              )}

              <div className="mt-auto flex flex-wrap justify-end gap-u2 pt-u2">
                <CerrarDialogo asChild>
                  <Button type="button" variante="secundario">
                    Cancelar
                  </Button>
                </CerrarDialogo>
                <Button
                  type="submit"
                  variante={decision === "aprobar" ? "primario" : "destructivo"}
                  disabled={enviando}
                >
                  {enviando
                    ? "Guardando…"
                    : decision === "aprobar"
                      ? "Aprobar documento"
                      : decision === "rechazar"
                        ? "Rechazar documento"
                        : "Rechazar y volver a pedir"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </ContenidoDialogo>
    </Dialogo>
  );
}
