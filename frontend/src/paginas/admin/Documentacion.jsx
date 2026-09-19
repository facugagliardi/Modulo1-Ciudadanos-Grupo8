import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2 } from "lucide-react";
import { cambiarEstadoSolicitud, crearSolicitud, listarSolicitudes } from "@/lib/api/endpoints/documentacion";
import { buscarPorDni } from "@/lib/api/endpoints/ciudadanos";
import { useRecurso } from "@/lib/useRecurso";
import { usePermiso } from "@/lib/auth/SesionContext";
import { PERMISOS } from "@/lib/auth/permisos";
import { mensajeAmable } from "@/lib/api/cliente";
import { diasHasta, formatearFecha, soloDigitos } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { etiquetaDe, TIPOS_DOCUMENTO } from "@/lib/dominio/listasBlancas";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { CambiarEstado } from "@/componentes/CambiarEstado";
import { Encabezado } from "@/componentes/Encabezado";
import { Identificador } from "@/componentes/Identificador";
import { Tabla } from "@/componentes/Tabla";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";

/**
 * Las solicitudes de documentación que emite el municipio.
 *
 * OJO CON EL ALCANCE DE ESTA PANTALLA: el backend **no tiene** un listado
 * global de documentos, sólo `GET /personas/{id}/documentos`. Por eso no hay
 * una bandeja general de validación: validar se hace desde el legajo de cada
 * persona, en su pestaña Documentos. Acá se gestionan las solicitudes, que sí
 * tienen listado propio. Anotado en sitemap.md, sección 6.
 */

const ESTADOS = [
  { valor: "PENDIENTE", etiqueta: "Pendiente" },
  { valor: "CUMPLIDA", etiqueta: "Cumplida" },
  { valor: "VENCIDA", etiqueta: "Vencida" },
];

const ORIGENES = [
  { valor: "INTERNA", etiqueta: "Interna" },
  { valor: "EVENTO", etiqueta: "Por evento de otro módulo" },
];

export function Documentacion() {
  const puedeSolicitar = usePermiso(PERMISOS.SOLICITAR_DOCUMENTACION);
  const puedeLeerTerceros = usePermiso(PERMISOS.LEER_TERCEROS);
  const { datos, cargando, error, recargar } = useRecurso(useCallback((s) => listarSolicitudes(s), []));

  const lista = datos ?? [];
  // Pendientes cuyo plazo ya pasó: nadie las marcó vencidas todavía.
  const vencidasDeHecho = lista.filter(
    (s) => s.estado === "PENDIENTE" && diasHasta(s.plazo) < 0,
  ).length;

  const columnas = [
    {
      clave: "titularId",
      titulo: "Titular",
      ancho: "w-32",
      render: (s) =>
        puedeLeerTerceros ? (
          <Link
            to={`/admin/padron/${s.titularId}`}
            className="font-medium text-expediente hover:underline"
          >
            <Identificador valor={`#${s.titularId}`} />
          </Link>
        ) : (
          <Identificador valor={`#${s.titularId}`} />
        ),
    },
    {
      clave: "tipoDocumento",
      titulo: "Documento",
      render: (s) => etiquetaDe(TIPOS_DOCUMENTO, s.tipoDocumento),
    },
    {
      clave: "plazo",
      titulo: "Plazo",
      ancho: "w-48",
      render: (s) => {
        const dias = diasHasta(s.plazo);
        const atrasada = s.estado === "PENDIENTE" && dias < 0;
        return (
          <span className={atrasada ? "font-medium text-sello" : "tabular"}>
            {formatearFecha(s.plazo)}
            {atrasada && <span className="ml-1.5">· vencido</span>}
          </span>
        );
      },
    },
    {
      clave: "origen",
      titulo: "Origen",
      ancho: "w-28",
      render: (s) => (
        <span className="text-apagado">{etiquetaDe(ORIGENES, s.origen) || "—"}</span>
      ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-36",
      render: (s) => <BadgeEstado entidad={ENTIDADES.SOLICITUD} estado={s.estado} />,
    },
    {
      clave: "acciones",
      titulo: "",
      ancho: "w-32",
      ordenable: false,
      render: (s) =>
        puedeSolicitar && s.estado !== "CUMPLIDA" ? (
          <CambiarEstado
            entidad={ENTIDADES.SOLICITUD}
            estadoActual={s.estado}
            nombreEntidad="esta solicitud"
            // Cumplir exige el documentoId del titular, y eso se hace desde el
            // portal del vecino al entregar. Desde acá sólo se puede vencer.
            destinosBloqueados={{ CUMPLIDA: "La cumple el titular al entregar" }}
            alConfirmar={async (nuevo) => {
              await cambiarEstadoSolicitud(s.solicitudId, { estado: nuevo });
              recargar();
            }}
            disparador={
              <Button variante="secundario" tamano="chico">
                Estado
              </Button>
            }
          />
        ) : null,
    },
  ];

  return (
    <>
      <Encabezado
        seccion="Gestión interna"
        titulo="Documentación"
        descripcion="Lo que el municipio le pide a vecinos y organizaciones, con su plazo."
        acciones={
          puedeSolicitar && (
            <PedirDocumentacion alGuardar={recargar}>
              <Button>
                <FilePlus2 aria-hidden="true" />
                Pedir documentación
              </Button>
            </PedirDocumentacion>
          )
        }
      />

      <Tabla
        columnas={columnas}
        filas={datos}
        claveFila={(s) => s.solicitudId}
        cargando={cargando}
        error={error}
        alReintentar={recargar}
        buscarEn={["tipoDocumento"]}
        etiquetaBusqueda="Buscar por tipo de documento"
        filtros={[
          { clave: "estado", etiqueta: "Estado", opciones: ESTADOS },
          { clave: "origen", etiqueta: "Origen", opciones: ORIGENES },
        ]}
        resumen={vencidasDeHecho > 0 ? `${vencidasDeHecho} con el plazo vencido` : undefined}
        vacio={{
          titulo: "No hay solicitudes",
          descripcion: "Cuando pidas documentación a alguien, va a aparecer acá.",
        }}
      />

      <p className="mt-u3 max-w-prose text-sm text-apagado">
        Para revisar y validar la documentación de una persona, entrá a su legajo desde el
        padrón: la pestaña <strong className="font-medium text-tinta">Documentos</strong>{" "}
        muestra lo que cargó.
      </p>
    </>
  );
}

/** Emitir una solicitud. El titular se busca por DNI, como en el alta de expediente. */
function PedirDocumentacion({ alGuardar, children }) {
  const [abierto, setAbierto] = useState(false);
  const [dni, setDni] = useState("");
  const [titular, setTitular] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [errorDni, setErrorDni] = useState(null);

  const [tipoDocumento, setTipo] = useState("DNI");
  const [plazo, setPlazo] = useState("");
  const [errorPlazo, setErrorPlazo] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  async function buscar(evento) {
    evento.preventDefault();
    setErrorDni(null);
    setTitular(null);
    const limpio = soloDigitos(dni);
    if (limpio.length < 7 || limpio.length > 9) {
      setErrorDni("El DNI tiene entre 7 y 9 dígitos.");
      return;
    }
    setBuscando(true);
    try {
      const res = await buscarPorDni(limpio);
      if (!res?.existe) {
        setErrorDni("No hay ningún vecino con ese DNI.");
        return;
      }
      setTitular(res);
    } catch (e) {
      setErrorDni(mensajeAmable(e));
    } finally {
      setBuscando(false);
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    // El backend rechaza un plazo en el pasado; se avisa antes de mandar.
    if (!plazo) {
      setErrorPlazo("Poné hasta cuándo tiene tiempo.");
      return;
    }
    if (plazo < manana) {
      setErrorPlazo("El plazo tiene que ser posterior a hoy.");
      return;
    }
    setEnviando(true);
    try {
      await crearSolicitud({
        titularId: titular.id,
        tipoDocumento,
        plazo,
        origen: "INTERNA",
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
    <Dialogo
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) {
          setDni("");
          setTitular(null);
          setPlazo("");
          setErrorDni(null);
          setErrorPlazo(null);
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>{children}</DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo="Pedir documentación"
        descripcion="Le va a aparecer al titular en su portal, con el plazo."
      >
        {!titular ? (
          <form onSubmit={buscar} noValidate className="flex flex-col gap-u2">
            <Campo
              etiqueta="DNI del titular"
              obligatorio
              inputMode="numeric"
              value={dni}
              onChange={(e) => {
                setDni(e.target.value);
                setErrorDni(null);
              }}
              error={errorDni}
            />
            <div className="flex justify-end gap-u2">
              <CerrarDialogo asChild>
                <Button type="button" variante="secundario">
                  Cancelar
                </Button>
              </CerrarDialogo>
              <Button type="submit" disabled={buscando}>
                {buscando ? "Buscando…" : "Buscar"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
            <div className="flex items-center justify-between gap-u2 rounded border border-borde bg-papel px-3 py-2">
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-apagado">
                  Titular
                </span>
                <span className="font-medium">
                  {[titular.nombre, titular.apellido].filter(Boolean).join(" ")}
                </span>
              </span>
              <Button type="button" variante="fantasma" tamano="chico" onClick={() => setTitular(null)}>
                Cambiar
              </Button>
            </div>

            <Campo etiqueta="Documento que se pide" obligatorio>
              {(props) => (
                <Selector
                  {...props}
                  opciones={TIPOS_DOCUMENTO}
                  value={tipoDocumento}
                  onChange={(e) => setTipo(e.target.value)}
                />
              )}
            </Campo>

            <Campo
              etiqueta="Plazo"
              obligatorio
              type="date"
              min={manana}
              ayuda="Hasta cuándo tiene tiempo de entregarlo."
              value={plazo}
              onChange={(e) => {
                setPlazo(e.target.value);
                setErrorPlazo(null);
              }}
              error={errorPlazo}
            />

            {errorGeneral && (
              <p
                role="alert"
                className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
              >
                {mensajeAmable(errorGeneral)}
              </p>
            )}

            <div className="mt-u1 flex justify-end gap-u2">
              <CerrarDialogo asChild>
                <Button type="button" variante="secundario">
                  Cancelar
                </Button>
              </CerrarDialogo>
              <Button type="submit" disabled={enviando}>
                {enviando ? "Enviando…" : "Pedir documentación"}
              </Button>
            </div>
          </form>
        )}
      </ContenidoDialogo>
    </Dialogo>
  );
}
