import { useCallback } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Building2, FileText, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { obtenerCiudadano } from "@/lib/api/endpoints/ciudadanos";
import { listarDomicilios, listarRepresentaciones } from "@/lib/api/endpoints/ciudadanos";
import { listarSolicitudes } from "@/lib/api/endpoints/documentacion";
import { listarExpedientes } from "@/lib/api/endpoints/expedientes";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { diasHasta, formatearFecha, nombreCompleto } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { EstadoVacio } from "@/componentes/Estados";
import { CargaConEsqueleto, ConEsqueleto, useUltimosDatos } from "@/componentes/Esqueleto";
import { Identificador } from "@/componentes/Identificador";
import { Encabezado } from "@/componentes/Encabezado";
import { Button } from "@/componentes/ui/button";
import { Card, CardCuerpo, CardEncabezado, CardTitulo } from "@/componentes/ui/card";

/**
 * "Mis trámites": todo lo que el municipio tiene del vecino, en una vista.
 *
 * Es la pantalla que pide el alcance del módulo. Arranca por lo que reclama
 * atención —documentación pedida, datos que faltan— y recién después muestra el
 * resto. Un vecino entra dos veces por año: lo primero que ve tiene que ser lo
 * que tiene que hacer.
 *
 * Nota: la línea de tiempo con hechos de otros módulos todavía no se puede
 * armar, porque el backend no consume eventos. Cuando lo haga, va acá.
 */
export function MisTramites() {
  const { id, esCiudadano, esJuridica } = useSesion();

  const ciudadano = useRecurso(
    useCallback((s) => (esCiudadano ? obtenerCiudadano(id, s) : Promise.resolve(null)), [id, esCiudadano]),
  );
  const domicilios = useRecurso(useCallback((s) => listarDomicilios(id, s), [id]));
  const solicitudes = useRecurso(useCallback((s) => listarSolicitudes(s), []));
  const expedientes = useRecurso(useCallback((s) => listarExpedientes(s), []));
  const representaciones = useRecurso(useCallback((s) => listarRepresentaciones(id, s), [id]));

  const ultimosDomicilios = useUltimosDatos(`domicilios:${id}`, domicilios.datos);
  const ultimoCiudadano = useUltimosDatos(`ciudadano:${id}`, ciudadano.datos);

  const algoCargando =
    ciudadano.cargando || domicilios.cargando || solicitudes.cargando || expedientes.cargando;
  const pendientes = (solicitudes.datos ?? []).filter((s) => s.estado === "PENDIENTE");
  const pendientesDeCarga = faltantesDelLegajo(domicilios.datos ?? [], ciudadano.datos, esCiudadano);

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo={
          ciudadano.datos ? `Hola, ${ciudadano.datos.nombre}` : esJuridica ? "Mis trámites" : "Mis trámites"
        }
        descripcion="Acá ves tus datos, lo que el municipio te pide y el estado de tus expedientes."
        acciones={
          ciudadano.datos && (
            <BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={ciudadano.datos.estado} />
          )
        }
      />

      {/* --- Lo que reclama atención va primero --- */}
      <ConEsqueleto
        recurso={solicitudes}
        clave={`solicitudes:${id}`}
        ejemplo={[]}
        etiqueta="Buscando lo que te piden…"
      >
        {(lista) => <TarjetaPedidos pendientes={lista.filter((s) => s.estado === "PENDIENTE")} />}
      </ConEsqueleto>

      <CargaConEsqueleto
        cargando={domicilios.cargando || ciudadano.cargando}
        etiqueta="Revisando tu legajo…"
        molde={() => (
          <TarjetaLegajo
            faltantes={faltantesDelLegajo(ultimosDomicilios ?? [], ultimoCiudadano, esCiudadano)}
          />
        )}
      >
        <TarjetaLegajo faltantes={pendientesDeCarga} />
      </CargaConEsqueleto>

      {/* Cada bloque entero en esqueleto mientras carga, con los últimos datos
          que se vieron en la sesión: el marco también tiene su estado de carga. */}
      <div className="grid gap-u3 md:grid-cols-2">
        {esCiudadano && (
          <ConEsqueleto
            recurso={ciudadano}
            clave={`ciudadano:${id}`}
            ejemplo={CIUDADANO_DE_EJEMPLO}
            etiqueta="Cargando tus datos…"
          >
            {(datos) => <BloqueMisDatos ciudadano={datos} />}
          </ConEsqueleto>
        )}

        <ConEsqueleto
          recurso={domicilios}
          clave={`domicilios:${id}`}
          ejemplo={[]}
          etiqueta="Cargando tu domicilio…"
        >
          {domicilios.cargando ? (
            <p className="text-apagado">Cargando…</p>
          ) : vigentes.length === 0 ? (
            <p className="text-apagado">Todavía no cargaste ninguno.</p>
          ) : (
            (() => {
              const principal = vigentes.find((d) => d.esPrincipal) ?? vigentes[0];
              return (
                <>
                  <p className="font-medium">
                    {principal.calle} {principal.numero}
                    {(principal.piso ?? principal.altura) ? `, ${principal.piso ?? principal.altura}` : ""}
                  </p>
                  <p className="text-[length:var(--texto-dato)] text-apagado">
                    Vigente desde el {formatearFecha(principal.vigenteDesde)}
                    {vigentes.length > 1 && ` · ${vigentes.length} domicilios vigentes`}
                  </p>
                </>
              );
            })()
          {(lista) => (
            <Bloque
              icono={MapPin}
              titulo="Mi domicilio"
              a="/portal/domicilios"
              textoEnlace={lista.some((d) => !d.vigenteHasta) ? "Ver historial" : "Cargar"}
            >
              <DomicilioPrincipal domicilios={lista} />
            </Bloque>
          )}
        </ConEsqueleto>

        <ConEsqueleto
          recurso={expedientes}
          clave={`expedientes:${id}`}
          ejemplo={[]}
          etiqueta="Cargando tus expedientes…"
        >
          {(lista) => (
            <Bloque icono={FileText} titulo="Mis expedientes" a="/portal/expedientes" textoEnlace="Ver todos">
              {lista.length === 0 ? (
                <p className="text-apagado">No tenés expedientes abiertos.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {lista.slice(0, 3).map((e) => (
                    <li key={e.expedienteId} className="flex items-center justify-between gap-u2">
                      <span className="min-w-0">
                        <Identificador valor={e.numero} className="text-sm" />
                        <span className="block truncate text-[length:var(--texto-dato)]">
                          {e.caratula}
                        </span>
                      </span>
                      <BadgeEstado entidad={ENTIDADES.EXPEDIENTE} estado={e.estado} />
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>
          )}
        </ConEsqueleto>

        <ConEsqueleto
          recurso={representaciones}
          clave={`representaciones:${id}`}
          ejemplo={[]}
          etiqueta="Cargando tus organizaciones…"
        >
          {(lista) => (
            <Bloque
              icono={Building2}
              titulo="Mis organizaciones"
              a="/portal/organizaciones"
              textoEnlace="Ver todas"
            >
              {lista.length === 0 ? (
                <p className="text-apagado">No representás a ninguna organización.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {lista.slice(0, 3).map((r) => (
                    <li key={r.representacionId} className="flex items-center justify-between gap-u2">
                      <span className="min-w-0 truncate">{r.razonSocial}</span>
                      <BadgeEstado entidad={ENTIDADES.REPRESENTACION} estado={r.estado} />
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>
          )}
        </ConEsqueleto>
      </div>

      {!algoCargando &&
        pendientes.length === 0 &&
        pendientesDeCarga.length === 0 &&
        (expedientes.datos ?? []).length === 0 && (
          <Card className="mt-u3">
            <CardCuerpo>
              <EstadoVacio
                titulo="No tenés nada pendiente"
                descripcion="Tus datos están al día y no hay trámites esperando algo tuyo."
              />
            </CardCuerpo>
          </Card>
        )}
    </>
  );
}

/** La ficha de la primera carga: largos típicos de un nombre y sus documentos. */
const CIUDADANO_DE_EJEMPLO = {
  nombre: "Nombre",
  apellido: "Apellido",
  dni: "30111222",
  cuil: "20301112223",
};

/** Lo que le falta al vecino para tener el legajo en condiciones. */
function faltantesDelLegajo(domicilios, ciudadano, esCiudadano) {
  const contactos = ciudadano?.contactos ?? [];
  return [
    domicilios.every((d) => d.vigenteHasta) && {
      texto: "Todavía no cargaste tu domicilio",
      a: "/portal/domicilios",
      accion: "Cargar domicilio",
    },
    esCiudadano &&
      contactos.length === 0 && {
        texto: "No tenemos cómo avisarte nada: falta un correo o un teléfono",
        a: "/portal/contactos",
        accion: "Agregar contacto",
      },
    esCiudadano &&
      contactos.length > 0 &&
      contactos.every((c) => !c.verificado) && {
        texto: "Ninguno de tus contactos está verificado",
        a: "/portal/contactos",
        accion: "Verificar",
      },
  ].filter(Boolean);
}

/** Lo que el municipio le pide, con su plazo. No se muestra si no pide nada. */
function TarjetaPedidos({ pendientes }) {
  if (pendientes.length === 0) return null;
  return (
    <Card className="mb-u3 border-alerta">
      <CardEncabezado className="border-alerta/40 bg-alerta-suave">
        <CardTitulo className="flex items-center gap-2 text-alerta">
          <AlertTriangle className="size-4" aria-hidden="true" />
          El municipio te pide documentación
        </CardTitulo>
      </CardEncabezado>
      <CardCuerpo className="flex flex-col gap-u2">
        {pendientes.map((s) => {
          const dias = diasHasta(s.plazo);
          const vencida = dias !== null && dias < 0;
          return (
            <div key={s.solicitudId} className="flex flex-wrap items-center justify-between gap-u2">
              <span>
                <span className="font-medium">{s.tipoDocumento.replace(/_/g, " ")}</span>
                <span
                  className={cn(
                    "block text-[length:var(--texto-dato)]",
                    vencida ? "font-medium text-sello" : "text-apagado",
                  )}
                >
                  {vencida
                    ? `Venció el ${formatearFecha(s.plazo)}`
                    : dias === 0
                      ? "Vence hoy"
                      : `Tenés hasta el ${formatearFecha(s.plazo)} · ${dias} días`}
                </span>
              </span>
              <Button asChild variante="secundario" tamano="chico">
                <Link to="/portal/documentacion-solicitada">Entregar</Link>
              </Button>
            </div>
          );
        })}
      </CardCuerpo>
    </Card>
  );
}

/** Lo que falta cargar para tener el legajo completo. No se muestra si no falta nada. */
function TarjetaLegajo({ faltantes }) {
  if (faltantes.length === 0) return null;
  return (
    <Card className="mb-u3">
      <CardEncabezado>
        <CardTitulo>Completá tu legajo</CardTitulo>
      </CardEncabezado>
      <CardCuerpo className="flex flex-col gap-u2">
        {faltantes.map((p) => (
          <div key={p.a + p.texto} className="flex flex-wrap items-center justify-between gap-u2">
            <p className="text-apagado">{p.texto}</p>
            <Button asChild variante="secundario" tamano="chico">
              <Link to={p.a}>{p.accion}</Link>
            </Button>
          </div>
        ))}
      </CardCuerpo>
    </Card>
  );
}

function BloqueMisDatos({ ciudadano }) {
  return (
    <Bloque icono={Users} titulo="Mis datos" a="/portal/perfil" textoEnlace="Ver y editar">
      <p className="font-medium">{nombreCompleto(ciudadano)}</p>
      <dl className="mt-1 flex flex-wrap gap-x-u3 gap-y-1 text-[length:var(--texto-dato)] text-apagado">
        <div className="flex gap-1.5">
          <dt>DNI</dt>
          <dd className="text-tinta">
            <Identificador valor={ciudadano.dni} tipo="dni" />
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>CUIL</dt>
          <dd className="text-tinta">
            <Identificador valor={ciudadano.cuil} tipo="cuit" />
          </dd>
        </div>
      </dl>
    </Bloque>
  );
}

/**
 * El domicilio principal vigente, o el aviso de que no hay. Va aparte porque es
 * también el molde de su esqueleto de carga.
 */
function DomicilioPrincipal({ domicilios }) {
  const vigentes = domicilios.filter((d) => !d.vigenteHasta);
  if (vigentes.length === 0) {
    return <p className="text-apagado">Todavía no cargaste ninguno.</p>;
  }
  const principal = vigentes.find((d) => d.esPrincipal) ?? vigentes[0];
  return (
    <>
      <p className="font-medium">
        {principal.calle} {principal.numero}
        {principal.altura ? `, ${principal.altura}` : ""}
      </p>
      <p className="text-[length:var(--texto-dato)] text-apagado">
        Vigente desde el {formatearFecha(principal.vigenteDesde)}
        {vigentes.length > 1 && ` · ${vigentes.length} domicilios vigentes`}
      </p>
    </>
  );
}

function Bloque({ icono: Icono, titulo, a, textoEnlace, children }) {
  return (
    <Card>
      <CardEncabezado>
        <CardTitulo className="flex items-center gap-2">
          <Icono className="size-4 text-apagado" aria-hidden="true" />
          {titulo}
        </CardTitulo>
        <Link
          to={a}
          className="group inline-flex items-center gap-1 text-[length:var(--texto-dato)] font-medium text-expediente hover:underline"
        >
          {textoEnlace}
          <ArrowRight
            className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </CardEncabezado>
      <CardCuerpo>{children}</CardCuerpo>
    </Card>
  );
}
