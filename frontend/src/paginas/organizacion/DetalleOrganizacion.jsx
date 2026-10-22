import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Building2, MapPin, Plus, Star, Trash2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  actualizarDueno,
  actualizarOrganizacion,
  agregarDueno,
  aprobarOrganizacion,
  cambiarEstadoOrganizacion,
  crearPropiedadOrganizacion,
  darDeBajaPropiedadOrganizacion,
  listarPropiedadesDeOrganizacion,
  marcarPropiedadOrganizacionPrincipal,
  obtenerOrganizacion,
  quitarDueno,
  rechazarOrganizacion,
} from "@/lib/api/endpoints/organizaciones";
import {
  cambiarEstadoRepresentacion,
  crearRepresentacion,
  listarRepresentacionesDeOrganizacion,
} from "@/lib/api/endpoints/representaciones";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { mensajeAmable } from "@/lib/api/cliente";
import { formatearFecha } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { ALCANCES_REPRESENTACION, etiquetaDe, TIPOS_ORGANIZACION, TIPOS_PROPIEDAD } from "@/lib/dominio/listasBlancas";
import { PERMISOS } from "@/lib/auth/permisos";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { BuscadorDeCiudadano, CiudadanoElegida } from "@/componentes/BuscadorDePersona";
import { CambiarEstado } from "@/componentes/CambiarEstado";
import { ConfirmarAccion } from "@/componentes/ConfirmarAccion";
import { Cargando, ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { Identificador } from "@/componentes/Identificador";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { CampoFecha, hoyISO } from "@/componentes/ui/fecha";
import { Card, CardCuerpo, CardEncabezado, CardTitulo } from "@/componentes/ui/card";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";
import { ListaPestanias, PanelPestania, Pestania, Pestanias } from "@/componentes/ui/tabs";

/**
 * Una organización con sus dueños y sus representantes.
 *
 * La misma pantalla sirve al portal y al backoffice. Lo que cambia es quién
 * puede tocar qué, y eso lo decide la regla del backend: sobre una organización
 * mandan sus **dueños** y sus **representantes vigentes**, además de quien tenga
 * el permiso correspondiente. Como el detalle devuelve las dos listas, la
 * pantalla puede calcular esa titularidad en vez de adivinarla.
 */
export function DetalleOrganizacion({ zona = "admin" }) {
  const { id } = useParams();
  const { id: miId } = useSesion();
  const puedeEditarTerceros = usePermisoSeguro(PERMISOS.EDITAR_TERCEROS);
  const puedeCambiarEstado = usePermisoSeguro(PERMISOS.CAMBIAR_ESTADO_TITULAR);
  const puedeGestionarRepr = usePermisoSeguro(PERMISOS.GESTIONAR_REPRESENTACIONES);
  const puedeAprobarOrg = usePermisoSeguro(PERMISOS.APROBAR_ORGANIZACION);
  const [procesandoAprobacion, setProcesandoAprobacion] = useState(false);

  const organizacion = useRecurso(useCallback((s) => obtenerOrganizacion(id, s), [id]));
  const representaciones = useRecurso(
    useCallback((s) => listarRepresentacionesDeOrganizacion(id, s), [id]),
  );
  const propiedades = useRecurso(
    useCallback((s) => listarPropiedadesDeOrganizacion(id, s), [id]),
  );

  const o = organizacion.datos;
  const esDueno = Boolean(o?.duenos?.some((d) => (d.ciudadanoId ?? d.personaId) === miId));
  const esRepresentante = Boolean(o?.representantesVigentes?.some((r) => (r.ciudadanoId ?? r.personaId) === miId));
  // La misma condición que aplica AutorizacionService del backend.
  const puedeEditar = esDueno || esRepresentante || puedeEditarTerceros;
  const puedeRepresentaciones = esDueno || esRepresentante || puedeGestionarRepr;

  const volverA = zona === "admin" ? "/admin/organizaciones" : "/portal/organizaciones";

  return (
    <>
      <Link
        to={volverA}
        className="mb-u2 inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] text-apagado hover:text-expediente"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a organizaciones
      </Link>

      {organizacion.cargando && <Cargando texto="Buscando la organización…" />}
      {organizacion.error && (
        <ErrorEnPantalla error={organizacion.error} alReintentar={organizacion.recargar} />
      )}

      {o && (
        <>
          <header className="mb-u3 flex flex-wrap items-start justify-between gap-u2 border-b border-borde pb-u3">
            <div className="min-w-0">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-apagado">
                {etiquetaDe(TIPOS_ORGANIZACION, o.tipo)}
              </p>
              <h1 className="flex flex-wrap items-center gap-u2">
                <Building2 className="size-6 shrink-0 text-apagado" aria-hidden="true" />
                {o.razonSocial}
                <BadgeEstado entidad={ENTIDADES.ORGANIZACION} estado={o.estado} />
              </h1>
              <dl className="mt-1.5 flex flex-wrap gap-x-u4 gap-y-1 text-[length:var(--texto-dato)] text-apagado">
                {o.nombreFantasia && (
                  <div className="flex gap-1.5">
                    <dt>Nombre de fantasía</dt>
                    <dd className="text-tinta">{o.nombreFantasia}</dd>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <dt>CUIT</dt>
                  <dd className="text-tinta">
                    <Identificador valor={o.cuit} tipo="cuit" />
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-wrap items-center gap-u2">
              {o.estado === "PENDIENTE" && puedeAprobarOrg && (
                <>
                  <Button
                    type="button"
                    disabled={procesandoAprobacion}
                    onClick={async () => {
                      setProcesandoAprobacion(true);
                      try {
                        await aprobarOrganizacion(o.organizacionId);
                        organizacion.recargar();
                      } finally {
                        setProcesandoAprobacion(false);
                      }
                    }}
                  >
                    Aprobar organización
                  </Button>
                  <Button
                    type="button"
                    variante="destructivo"
                    disabled={procesandoAprobacion}
                    onClick={async () => {
                      setProcesandoAprobacion(true);
                      try {
                        await rechazarOrganizacion(o.organizacionId);
                        organizacion.recargar();
                      } finally {
                        setProcesandoAprobacion(false);
                      }
                    }}
                  >
                    Rechazar
                  </Button>
                </>
              )}
              {puedeEditar && (
                <EditarOrganizacion organizacion={o} alGuardar={organizacion.recargar} />
              )}
              {puedeCambiarEstado && (
                <CambiarEstado
                  entidad={ENTIDADES.ORGANIZACION}
                  estadoActual={o.estado}
                  nombreEntidad="esta organización"
                  alConfirmar={async (nuevo) => {
                    await cambiarEstadoOrganizacion(o.organizacionId, nuevo);
                    organizacion.recargar();
                  }}
                />
              )}
            </div>
          </header>

          {o.estado === "PENDIENTE" && (
            <div className="mb-u3 rounded border border-aviso/40 bg-aviso-suave p-3 text-sm text-tinta">
              <strong>Organización pendiente de aprobación:</strong> Esta entidad fue registrada y requiere ser aprobada por el área administrativa para quedar activa.
            </div>
          )}

          <Pestanias defaultValue="datos">
            <ListaPestanias>
              <Pestania value="datos">Datos</Pestania>
              <Pestania value="duenos">
                Dueños
                <span className="ml-1.5 text-apagado">{o.duenos?.length ?? 0}</span>
              </Pestania>
              <Pestania value="representaciones">
                Representantes
                {representaciones.datos && (
                  <span className="ml-1.5 text-apagado">{representaciones.datos.length}</span>
                )}
              </Pestania>
              <Pestania value="propiedades">
                Propiedades
                {propiedades.datos && (
                  <span className="ml-1.5 text-apagado">{propiedades.datos.length}</span>
                )}
              </Pestania>
            </ListaPestanias>

            <PanelPestania value="datos">
              <Card>
                <CardCuerpo>
                  <dl className="grid gap-u3 sm:grid-cols-2 lg:grid-cols-3">
                    <Dato etiqueta="Razón social" valor={o.razonSocial} />
                    <Dato etiqueta="Nombre de fantasía" valor={o.nombreFantasia} />
                    <Dato etiqueta="Tipo" valor={etiquetaDe(TIPOS_ORGANIZACION, o.tipo)} />
                    <Dato etiqueta="CUIT" valor={<Identificador valor={o.cuit} tipo="cuit" />} />
                    <Dato etiqueta="Identificador fiscal" valor={<Identificador valor={o.taxId} />} />
                    <Dato
                      etiqueta="Estado"
                      valor={<BadgeEstado entidad={ENTIDADES.ORGANIZACION} estado={o.estado} />}
                    />
                  </dl>
                </CardCuerpo>
              </Card>

              {o.domicilioPrincipal && (
                <Card className="mt-u3">
                  <CardEncabezado>
                    <CardTitulo>Domicilio principal</CardTitulo>
                  </CardEncabezado>
                  <CardCuerpo>
                    <p className="font-medium">
                      {o.domicilioPrincipal.calle} {o.domicilioPrincipal.numero}
                      {(o.domicilioPrincipal.piso ?? o.domicilioPrincipal.altura) ? `, ${o.domicilioPrincipal.piso ?? o.domicilioPrincipal.altura}` : ""}
                    </p>
                    <p className="text-[length:var(--texto-dato)] text-apagado">
                      {etiquetaDe(TIPOS_PROPIEDAD, o.domicilioPrincipal.tipo)} · vigente desde{" "}
                      {formatearFecha(o.domicilioPrincipal.vigenteDesde)}
                    </p>
                  </CardCuerpo>
                </Card>
              )}
            </PanelPestania>

            {/* --- Dueños --- */}
            <PanelPestania value="duenos">
              {puedeEditar && (
                <div className="mb-u2 flex justify-end">
                  <AgregarDueno
                    organizacion={o}
                    alGuardar={organizacion.recargar}
                  />
                </div>
              )}

              {(o.duenos?.length ?? 0) === 0 ? (
                <EstadoVacio
                  titulo="Sin dueños registrados"
                  descripcion="Toda organización debería tener al menos un titular."
                />
              ) : (
                <ul className="lista-escalonada flex flex-col gap-u2">
                  {o.duenos.map((d) => (
                    <li key={d.ciudadanoId ?? d.personaId}>
                      <Card>
                        <CardCuerpo className="flex flex-wrap items-center justify-between gap-u2">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {zona === "admin" && puedeEditarTerceros ? (
                                <Link
                                  to={`/admin/padron/${d.ciudadanoId ?? d.personaId}`}
                                  className="text-expediente hover:underline"
                                >
                                  {[d.nombre, d.apellido].filter(Boolean).join(" ")}
                                </Link>
                              ) : (
                                [d.nombre, d.apellido].filter(Boolean).join(" ")
                              )}
                            </p>
                            <p className="text-[length:var(--texto-dato)] text-apagado">
                              DNI <Identificador valor={d.dni} tipo="dni" />
                              {d.porcentajeTitularidad != null &&
                                ` · ${d.porcentajeTitularidad}% de titularidad`}
                            </p>
                          </div>

                          {puedeEditar &&
                            (o.duenos.length === 1 ? (
                              <p className="max-w-[16rem] text-right text-sm text-apagado">
                                Es el único dueño. Agregá otro antes de quitarlo.
                              </p>
                            ) : (
                              <QuitarDueno
                                organizacion={o}
                                dueno={d}
                                alGuardar={organizacion.recargar}
                              />
                            ))}
                        </CardCuerpo>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </PanelPestania>

            {/* --- Representaciones --- */}
            <PanelPestania value="representaciones">
              {puedeRepresentaciones && (
                <div className="mb-u2 flex justify-end">
                  <OtorgarRepresentacion
                    organizacionId={o.organizacionId}
                    alGuardar={() => {
                      representaciones.recargar();
                      organizacion.recargar();
                    }}
                  />
                </div>
              )}

              {representaciones.cargando && <Cargando />}
              {representaciones.error && (
                <ErrorEnPantalla
                  error={representaciones.error}
                  alReintentar={representaciones.recargar}
                />
              )}

              {representaciones.datos?.length === 0 && (
                <EstadoVacio
                  titulo="Nadie tiene poder para actuar por esta organización"
                  descripcion="Un representante puede hacer trámites en su nombre ante otras áreas del municipio."
                />
              )}

              {representaciones.datos?.length > 0 && (
                <ul className="lista-escalonada flex flex-col gap-u2">
                  {representaciones.datos.map((r) => (
                    <li key={r.representacionId}>
                      <Card className={cn(r.estado !== "VIGENTE" && "opacity-75")}>
                        <CardCuerpo className="flex flex-wrap items-center justify-between gap-u2">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-u2 font-medium">
                              {[r.nombre, r.apellido].filter(Boolean).join(" ") ||
                                `Ciudadano #${r.ciudadanoId ?? r.personaId}`}
                              <BadgeEstado entidad={ENTIDADES.REPRESENTACION} estado={r.estado} />
                            </p>
                            <p className="text-[length:var(--texto-dato)] text-apagado">
                              Alcance {etiquetaDe(ALCANCES_REPRESENTACION, r.alcance).toLowerCase()} ·
                              desde el {formatearFecha(r.desde)}
                              {r.hasta ? ` hasta el ${formatearFecha(r.hasta)}` : " · sin vencimiento"}
                            </p>
                          </div>

                          {puedeRepresentaciones && (
                            <CambiarEstado
                              entidad={ENTIDADES.REPRESENTACION}
                              estadoActual={r.estado}
                              nombreEntidad="esta representación"
                              alConfirmar={async (nuevo) => {
                                await cambiarEstadoRepresentacion(r.representacionId, nuevo);
                                representaciones.recargar();
                                organizacion.recargar();
                              }}
                              disparador={
                                <Button variante="secundario" tamano="chico">
                                  Estado
                                </Button>
                              }
                            />
                          )}
                        </CardCuerpo>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </PanelPestania>

            {/* --- Propiedades --- */}
            <PanelPestania value="propiedades">
              {puedeEditar && (
                <div className="mb-u2 flex justify-end">
                  <FormularioPropiedadOrganizacion
                    organizacionId={o.organizacionId}
                    alGuardar={() => {
                      propiedades.recargar();
                      organizacion.recargar();
                    }}
                    disparador={
                      <Button>
                        <Plus className="size-4 mr-1.5" aria-hidden="true" />
                        Agregar propiedad
                      </Button>
                    }
                  />
                </div>
              )}

              {propiedades.cargando && <Cargando />}
              {propiedades.error && (
                <ErrorEnPantalla
                  error={propiedades.error}
                  alReintentar={propiedades.recargar}
                />
              )}

              {propiedades.datos?.length === 0 && (
                <EstadoVacio
                  titulo="Sin propiedades registradas"
                  descripcion="Esta organización no tiene domicilios o inmuebles registrados."
                  accion={
                    puedeEditar && (
                      <FormularioPropiedadOrganizacion
                        organizacionId={o.organizacionId}
                        sinPropiedadesAun
                        alGuardar={() => {
                          propiedades.recargar();
                          organizacion.recargar();
                        }}
                        disparador={<Button>Cargar primera propiedad</Button>}
                      />
                    )
                  }
                />
              )}

              {propiedades.datos?.length > 0 && (
                <ul className="lista-escalonada flex flex-col gap-u2">
                  {propiedades.datos.map((p) => {
                    const vigente = !p.vigenteHasta;
                    return (
                      <li key={p.propiedadId}>
                        <Card className={cn(!vigente && "opacity-75")}>
                          <CardCuerpo className="flex flex-wrap items-center justify-between gap-u2">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-u2 font-medium">
                                <MapPin className="size-4 text-apagado" aria-hidden="true" />
                                {p.calle} {p.numero}
                                {(p.piso ?? p.altura) ? `, ${p.piso ?? p.altura}` : ""}
                                {p.esPrincipal && (
                                  <span className="inline-flex items-center gap-1 rounded bg-expediente-suave px-2 py-0.5 text-xs font-semibold text-expediente">
                                    <Star className="size-3 fill-current" aria-hidden="true" />
                                    Principal
                                  </span>
                                )}
                                {!vigente && (
                                  <span className="inline-flex items-center rounded bg-apagado/15 px-2 py-0.5 text-xs font-medium text-apagado">
                                    Baja
                                  </span>
                                )}
                              </p>
                              <p className="text-[length:var(--texto-dato)] text-apagado">
                                {etiquetaDe(TIPOS_PROPIEDAD, p.tipo)} · vigente desde{" "}
                                {formatearFecha(p.vigenteDesde)}
                                {p.vigenteHasta ? ` hasta el ${formatearFecha(p.vigenteHasta)}` : ""}
                              </p>
                            </div>

                            {puedeEditar && vigente && (
                              <div className="flex items-center gap-2">
                                {!p.esPrincipal && (
                                  <Button
                                    type="button"
                                    variante="secundario"
                                    tamano="chico"
                                    onClick={async () => {
                                      await marcarPropiedadOrganizacionPrincipal(o.organizacionId, p.propiedadId);
                                      propiedades.recargar();
                                      organizacion.recargar();
                                    }}
                                  >
                                    <Star className="size-4 mr-1 text-aviso" aria-hidden="true" />
                                    Hacer principal
                                  </Button>
                                )}
                                <ConfirmarAccion
                                  titulo="¿Dar de baja esta propiedad?"
                                  descripcion="El inmueble quedará en el historial de la organización con su fecha de cese."
                                  textoBotonConfirmar="Dar de baja"
                                  alConfirmar={async () => {
                                    await darDeBajaPropiedadOrganizacion(o.organizacionId, p.propiedadId);
                                    propiedades.recargar();
                                    organizacion.recargar();
                                  }}
                                  disparador={
                                    <Button
                                      type="button"
                                      variante="fantasma"
                                      tamano="chico"
                                      aria-label={`Dar de baja propiedad ${p.calle} ${p.numero}`}
                                    >
                                      <Trash2 className="size-4 text-sello" aria-hidden="true" />
                                    </Button>
                                  }
                                />
                              </div>
                            )}
                          </CardCuerpo>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelPestania>
          </Pestanias>
        </>
      )}
    </>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-apagado">{etiqueta}</dt>
      <dd className="mt-0.5 text-tinta">{valor || <span className="text-apagado">—</span>}</dd>
    </div>
  );
}

/** El hook de permiso, tolerante a que no haya sesión (por si se renderiza suelto). */
function usePermisoSeguro(permiso) {
  const { tienePermiso } = useSesion();
  return tienePermiso(permiso);
}

function EditarOrganizacion({ organizacion, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState({
    razonSocial: organizacion.razonSocial ?? "",
    nombreFantasia: organizacion.nombreFantasia ?? "",
    tipo: organizacion.tipo ?? "OTRO",
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!valores.razonSocial.trim()) {
      setErrores({ razonSocial: "La razón social no puede quedar vacía." });
      return;
    }
    setEnviando(true);
    try {
      await actualizarOrganizacion(organizacion.organizacionId, valores);
      alGuardar?.();
      setAbierto(false);
    } catch (e) {
      if (e?.tieneErroresDeCampo) setErrores(e.errores);
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
          setValores({
            razonSocial: organizacion.razonSocial ?? "",
            nombreFantasia: organizacion.nombreFantasia ?? "",
            tipo: organizacion.tipo ?? "OTRO",
          });
          setErrores({});
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>
        <Button variante="secundario">Editar datos</Button>
      </DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo="Editar organización"
        descripcion="El CUIT no se puede cambiar: identifica a la organización ante todo el municipio."
      >
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          <Campo
            etiqueta="Razón social"
            obligatorio
            value={valores.razonSocial}
            onChange={(e) => {
              setValores((v) => ({ ...v, razonSocial: e.target.value }));
              setErrores({});
            }}
            error={errores.razonSocial}
          />
          <Campo
            etiqueta="Nombre de fantasía"
            value={valores.nombreFantasia}
            onChange={(e) => setValores((v) => ({ ...v, nombreFantasia: e.target.value }))}
            error={errores.nombreFantasia}
          />
          <Campo etiqueta="Tipo">
            {(props) => (
              <Selector
                {...props}
                opciones={TIPOS_ORGANIZACION}
                value={valores.tipo}
                onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value }))}
              />
            )}
          </Campo>

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
              {enviando ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}

/** Valor del selector de origen cuando el porcentaje sale del pool sin asignar. */
const DESDE_LIBRE = "libre";

/** Y el espejo: el porcentaje del que se va no va a nadie, queda suelto. */
const QUEDA_LIBRE = "libre";

/**
 * Baja de un dueño, con transferencia de su titularidad.
 *
 * Es el espejo exacto de {@link AgregarDueno}: si alguien entra tomando de
 * otro, quien sale tiene que poder dejarle lo suyo a alguien. Sin esto, quitar
 * a un dueño con 40% evaporaba ese 40% —quedaba sin asignar sin que nadie lo
 * decidiera— y había que acordarse de ir a repartirlo a mano.
 *
 * El orden es al revés que en el alta y por la misma razón: acá se quita
 * primero y después se sube al receptor. Si se subiera antes, en el instante
 * intermedio la suma pasaría de 100 —el que se va todavía tiene lo suyo— y el
 * backend contesta 409.
 */
function QuitarDueno({ organizacion, dueno, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState(QUEDA_LIBRE);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const nombre = nombreDe(dueno);
  const cede = Number(dueno.porcentajeTitularidad ?? 0);
  const duenoId = dueno.ciudadanoId ?? dueno.personaId;
  const otros = (organizacion.duenos ?? []).filter((x) => (x.ciudadanoId ?? x.personaId) !== duenoId);
  const receptor = otros.find((x) => String(x.ciudadanoId ?? x.personaId) === destino) ?? null;

  const opciones = [
    { valor: QUEDA_LIBRE, etiqueta: "Que quede sin asignar" },
    ...otros.map((x) => ({
      valor: String(x.ciudadanoId ?? x.personaId),
      etiqueta: `${nombreDe(x)} — tiene ${redondear(x.porcentajeTitularidad ?? 0)}%`,
    })),
  ];

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    setEnviando(true);

    let yaSeQuito = false;
    try {
      await quitarDueno(organizacion.organizacionId, duenoId);
      yaSeQuito = true;

      if (receptor) {
        await actualizarDueno(
          organizacion.organizacionId,
          receptor.ciudadanoId ?? receptor.personaId,
          Number(receptor.porcentajeTitularidad ?? 0) + cede,
        );
      }

      alGuardar?.();
      setAbierto(false);
    } catch (e) {
      // Si la baja entró y falló el traspaso, ese porcentaje quedó suelto.
      // Decirlo evita que la titularidad quede descuadrada sin que se note.
      e.traspasoAMedias = yaSeQuito;
      setErrorGeneral(e);
      if (yaSeQuito) alGuardar?.();
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
          setDestino(QUEDA_LIBRE);
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>
        <Button variante="fantasma" tamano="chico" aria-label={`Quitar a ${nombre}`}>
          <Trash2 aria-hidden="true" />
        </Button>
      </DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo="Quitar a este dueño"
        descripcion={`${nombre} deja de figurar como titular. Sus datos ciudadanoles no se tocan.`}
      >
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          {cede > 0 ? (
            <>
              <Campo etiqueta={`¿A quién le pasa su ${redondear(cede)}%?`}>
                {(props) => (
                  <Selector
                    {...props}
                    opciones={opciones}
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                  />
                )}
              </Campo>

              {receptor ? (
                <p className="rounded border border-borde bg-papel px-3 py-2 text-[length:var(--texto-dato)]">
                  <ArrowRightLeft
                    className="mr-1.5 inline size-4 align-text-bottom text-expediente"
                    aria-hidden="true"
                  />
                  <strong className="font-medium">{nombreDe(receptor)}</strong> pasa de{" "}
                  {redondear(receptor.porcentajeTitularidad ?? 0)}% a{" "}
                  <strong className="font-medium">
                    {redondear(Number(receptor.porcentajeTitularidad ?? 0) + cede)}%
                  </strong>
                  .
                </p>
              ) : (
                <p className="text-[length:var(--texto-dato)] text-apagado">
                  Ese {redondear(cede)}% va a quedar sin asignar. Podés repartirlo después
                  agregando un dueño.
                </p>
              )}
            </>
          ) : (
            <p className="text-[length:var(--texto-dato)] text-apagado">
              No tiene un porcentaje cargado, así que no hay titularidad que transferir.
            </p>
          )}

          {errorGeneral && (
            <p
              role="alert"
              className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
            >
              {errorGeneral.traspasoAMedias
                ? `Se quitó a ${nombre} pero no se pudo pasar su ${redondear(cede)}%. Ese porcentaje quedó sin asignar.`
                : errorGeneral.status === 409
                  ? "No se puede quitar: una organización no puede quedarse sin dueños."
                  : mensajeAmable(errorGeneral)}
            </p>
          )}

          <div className="mt-u1 flex justify-end gap-u2">
            <CerrarDialogo asChild>
              <Button type="button" variante="secundario">
                Cancelar
              </Button>
            </CerrarDialogo>
            <Button type="submit" variante="destructivo" disabled={enviando}>
              {enviando ? "Quitando…" : receptor ? "Quitar y transferir" : "Quitar dueño"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}

const nombreDe = (d) => [d?.nombre, d?.apellido].filter(Boolean).join(" ") || "—";

/**
 * Los porcentajes vienen del backend como BigDecimal y llegan con decimales que
 * casi siempre son cero. `50.00%` no aporta nada sobre `50%`, y la resta en
 * vivo se lee peor. Se muestran los decimales sólo cuando existen de verdad.
 */
const redondear = (n) => {
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return String(Number(num.toFixed(2)));
};

/**
 * Alta de dueño, con transferencia de titularidad.
 *
 * Un dueño nuevo puede entrar de dos formas: tomando de lo que todavía no está
 * asignado, o recibiendo parte de lo que hoy tiene otro dueño. La segunda es la
 * que pasa en la vida real —entra un socio y los que ya estaban se diluyen— y
 * antes no se podía expresar: había que quitar al dueño y volver a agregarlo.
 *
 * El orden de las dos llamadas no es casual. Primero baja al que cede y después
 * agrega al nuevo. Al revés, en el instante intermedio la suma pasaría de 100 y
 * el backend contesta 409. Además, si algo falla entre una y otra, el estado
 * que queda es "sobra un porcentaje sin asignar", que es válido y se arregla
 * solo con volver a intentar. La transferencia no es atómica —el backend no
 * expone una operación única— así que lo que se elige es cuál es el estado
 * intermedio menos dañino.
 */
function AgregarDueno({ organizacion, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [ciudadano, setCiudadano] = useState(null);
  const [porcentaje, setPorcentaje] = useState("");
  const [origen, setOrigen] = useState(DESDE_LIBRE);
  const [errorPorcentaje, setErrorPorcentaje] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const duenos = organizacion.duenos ?? [];
  // El backend rechaza con 409 si la suma supera 100. Se avisa antes.
  const asignado = duenos.reduce((t, d) => t + Number(d.porcentajeTitularidad ?? 0), 0);
  const disponible = Math.max(0, 100 - asignado);

  // Sólo puede ceder quien tiene un porcentaje cargado: de un dueño sin
  // porcentaje no hay nada que restar.
  const cedentesPosibles = duenos.filter((d) => Number(d.porcentajeTitularidad ?? 0) > 0);
  const cedente = duenos.find((d) => String(d.ciudadanoId ?? d.personaId) === origen) ?? null;
  const desdeLibre = origen === DESDE_LIBRE;

  const num = porcentaje === "" ? null : Number(porcentaje);
  const numValido = num !== null && !Number.isNaN(num) && num > 0;
  const tope = desdeLibre ? disponible : Number(cedente?.porcentajeTitularidad ?? 0);
  const quedaAlCedente = cedente && numValido ? Number(cedente.porcentajeTitularidad) - num : null;

  const opcionesOrigen = [
    { valor: DESDE_LIBRE, etiqueta: `Sin asignar — hay ${redondear(disponible)}% libre` },
    ...cedentesPosibles.map((d) => ({
      valor: String(d.ciudadanoId ?? d.personaId),
      etiqueta: `${nombreDe(d)} — tiene ${redondear(d.porcentajeTitularidad)}%`,
    })),
  ];

  function validar() {
    if (!desdeLibre) {
      // Cediendo, el porcentaje deja de ser opcional: sin número no hay nada
      // que transferir.
      if (!numValido) {
        setErrorPorcentaje("Indicá cuánto le transferís.");
        return false;
      }
      if (num > tope) {
        setErrorPorcentaje(`${nombreDe(cedente)} tiene ${redondear(tope)}%. No puede ceder más.`);
        return false;
      }
      if (quedaAlCedente < 0.01) {
        setErrorPorcentaje(
          `${nombreDe(cedente)} quedaría en 0%. Para que ceda todo, quitalo como dueño después de agregar al nuevo.`,
        );
        return false;
      }
      return true;
    }

    if (num === null) return true; // desde el pool libre el porcentaje es opcional
    if (Number.isNaN(num) || num <= 0 || num > 100) {
      setErrorPorcentaje("Tiene que ser un número entre 0,01 y 100.");
      return false;
    }
    if (num > disponible) {
      setErrorPorcentaje(`Sólo queda ${redondear(disponible)}% sin asignar.`);
      return false;
    }
    return true;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;

    setEnviando(true);
    let cedenteYaBajado = false;
    try {
      if (cedente) {
        await actualizarDueno(organizacion.organizacionId, cedente.ciudadanoId ?? cedente.personaId, quedaAlCedente);
        cedenteYaBajado = true;
      }
      await agregarDueno(organizacion.organizacionId, {
        ciudadanoId: ciudadano.id,
        porcentajeTitularidad: num ?? undefined,
      });
      alGuardar?.();
      setAbierto(false);
      setCiudadano(null);
      setPorcentaje("");
      setOrigen(DESDE_LIBRE);
    } catch (e) {
      // Si el alta falló con el cedente ya bajado, el porcentaje quedó suelto.
      // Decirlo explícitamente evita que alguien cierre el diálogo creyendo que
      // no pasó nada y se encuentre después con la titularidad descuadrada.
      e.transferenciaAMedias = cedenteYaBajado;
      setErrorGeneral(e);
      if (cedenteYaBajado) alGuardar?.();
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
          setCiudadano(null);
          setPorcentaje("");
          setOrigen(DESDE_LIBRE);
          setErrorPorcentaje(null);
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>
        <Button>
          <UserPlus aria-hidden="true" />
          Agregar dueño
        </Button>
      </DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo="Agregar dueño"
        descripcion="Tiene que ser una ciudadano ya registrada en el municipio."
      >
        {!ciudadano ? (
          <BuscadorDeCiudadano etiqueta="DNI del nuevo dueño" alEncontrar={setCiudadano} autoFocus />
        ) : (
          <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
            <CiudadanoElegida
              ciudadano={ciudadano}
              etiqueta="Nuevo dueño"
              alCambiar={() => setCiudadano(null)}
            />

            <Campo
              etiqueta="Porcentaje de titularidad"
              type="number"
              step="0.01"
              min="0.01"
              max={tope || 100}
              obligatorio={!desdeLibre}
              ayuda={
                desdeLibre
                  ? asignado > 0
                    ? `Hay ${redondear(asignado)}% asignado. Queda ${redondear(disponible)}% disponible. Podés dejarlo vacío.`
                    : "Opcional."
                  : undefined
              }
              value={porcentaje}
              onChange={(e) => {
                setPorcentaje(e.target.value);
                setErrorPorcentaje(null);
              }}
              error={errorPorcentaje}
            />

            {cedentesPosibles.length > 0 && (
              <Campo etiqueta="¿De dónde sale?">
                {(props) => (
                  <Selector
                    {...props}
                    opciones={opcionesOrigen}
                    value={origen}
                    onChange={(e) => {
                      setOrigen(e.target.value);
                      setErrorPorcentaje(null);
                    }}
                  />
                )}
              </Campo>
            )}

            {/* La resta, en vivo. Es la única forma de que alguien confirme sin
                tener que hacer la cuenta de cabeza. */}
            {cedente && numValido && quedaAlCedente >= 0.01 && (
              <p className="rounded border border-borde bg-papel px-3 py-2 text-[length:var(--texto-dato)]">
                <ArrowRightLeft
                  className="mr-1.5 inline size-4 align-text-bottom text-expediente"
                  aria-hidden="true"
                />
                <strong className="font-medium">{nombreDe(cedente)}</strong> pasa de{" "}
                {redondear(cedente.porcentajeTitularidad)}% a{" "}
                <strong className="font-medium">{redondear(quedaAlCedente)}%</strong>, y{" "}
                {ciudadano.nombre} entra con{" "}
                <strong className="font-medium">{redondear(num)}%</strong>.
              </p>
            )}

            {errorGeneral && (
              <p
                role="alert"
                className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
              >
                {errorGeneral.transferenciaAMedias
                  ? `Se descontó el porcentaje de ${nombreDe(cedente)} pero no se pudo agregar al nuevo dueño. Ese porcentaje quedó sin asignar: volvé a intentarlo.`
                  : errorGeneral.status === 409
                    ? "Esa ciudadano ya es dueña, o la suma de titularidades supera el 100%."
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
                {enviando ? "Agregando…" : "Agregar dueño"}
              </Button>
            </div>
          </form>
        )}
      </ContenidoDialogo>
    </Dialogo>
  );
}

function OtorgarRepresentacion({ organizacionId, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [ciudadano, setCiudadano] = useState(null);
  const hoy = hoyISO();
  const [valores, setValores] = useState({ alcance: "TRAMITES", desde: hoy, hasta: "" });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    const e = {};
    if (!valores.desde) e.desde = "Indicá desde cuándo.";
    if (valores.hasta && valores.hasta < valores.desde) {
      e.hasta = "El vencimiento no puede ser anterior al inicio.";
    }
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      await crearRepresentacion({
        ciudadanoId: ciudadano.id,
        personaId: ciudadano.id,
        organizacionId: Number(organizacionId),
        alcance: valores.alcance,
        desde: valores.desde,
        // null explícito: el backend lo entiende como "sin vencimiento".
        hasta: valores.hasta || null,
      });
      alGuardar?.();
      setAbierto(false);
    } catch (err) {
      setErrorGeneral(err);
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
          setCiudadano(null);
          setValores({ alcance: "TRAMITES", desde: hoy, hasta: "" });
          setErrores({});
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>
        <Button type="button">
          <UserPlus aria-hidden="true" />
          Otorgar representación
        </Button>
      </DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo="Otorgar representación"
        descripcion="La ciudadano va a poder hacer trámites en nombre de la organización ante otras áreas."
      >
        {!ciudadano ? (
          <BuscadorDeCiudadano etiqueta="DNI del representante" alEncontrar={setCiudadano} autoFocus />
        ) : (
          <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
            <CiudadanoElegida
              ciudadano={ciudadano}
              etiqueta="Representante"
              alCambiar={() => setCiudadano(null)}
            />

            <Campo etiqueta="Alcance" obligatorio ayuda="Qué puede hacer en nombre de la organización.">
              {(props) => (
                <Selector
                  {...props}
                  opciones={ALCANCES_REPRESENTACION}
                  value={valores.alcance}
                  onChange={(e) => setValores((v) => ({ ...v, alcance: e.target.value }))}
                />
              )}
            </Campo>

            <div className="grid gap-u2 sm:grid-cols-2">
              <CampoFecha
                etiqueta="Desde"
                obligatorio
                value={valores.desde}
                onChange={(e) => {
                  setValores((v) => ({ ...v, desde: e.target.value }));
                  setErrores({});
                }}
                error={errores.desde}
              />
              <CampoFecha
                etiqueta="Hasta"
                min={valores.desde}
                ayuda="Vacío = sin vencimiento."
                value={valores.hasta}
                onChange={(e) => {
                  setValores((v) => ({ ...v, hasta: e.target.value }));
                  setErrores({});
                }}
                error={errores.hasta}
              />
            </div>

            {errorGeneral && (
              <p
                role="alert"
                className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
              >
                {errorGeneral.status === 409
                  ? "Esa ciudadano ya tiene una representación activa en esta organización."
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
                {enviando ? "Otorgando…" : "Otorgar representación"}
              </Button>
            </div>
          </form>
        )}
      </ContenidoDialogo>
    </Dialogo>
  );
}

function FormularioPropiedadOrganizacion({ organizacionId, sinPropiedadesAun, disparador, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState({
    tipo: "LOCAL",
    calle: "",
    numero: "",
    piso: "",
    longitud: "",
    latitud: "",
    esPrincipal: false,
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function validar() {
    const e = {};
    if (!valores.calle.trim()) e.calle = "Ingresá la calle.";
    if (!valores.numero.trim()) e.numero = "Ingresá la altura.";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      await crearPropiedadOrganizacion(organizacionId, {
        ...valores,
        esPrincipal: sinPropiedadesAun || valores.esPrincipal,
      });
      alGuardar?.();
      setAbierto(false);
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
          setValores({
            tipo: "LOCAL",
            calle: "",
            numero: "",
            piso: "",
            longitud: "",
            latitud: "",
            esPrincipal: false,
          });
          setErrores({});
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>{disparador}</DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo="Agregar propiedad a la organización"
        descripcion="Registrá una sede, sucursal, local o depósito de la empresa."
      >
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          <Campo etiqueta="Tipo de inmueble" obligatorio>
            {(props) => (
              <Selector
                {...props}
                opciones={TIPOS_PROPIEDAD}
                value={valores.tipo}
                onChange={(e) => cambiar("tipo", e.target.value)}
              />
            )}
          </Campo>

          <div className="grid gap-u2 sm:grid-cols-[2fr_1fr_1fr]">
            <Campo
              etiqueta="Calle"
              obligatorio
              value={valores.calle}
              onChange={(e) => cambiar("calle", e.target.value)}
              error={errores.calle}
            />
            <Campo
              etiqueta="Número"
              obligatorio
              inputMode="numeric"
              value={valores.numero}
              onChange={(e) => cambiar("numero", e.target.value)}
              error={errores.numero}
            />
            <Campo
              etiqueta="Piso y depto."
              ayuda="Opcional"
              value={valores.piso}
              onChange={(e) => cambiar("piso", e.target.value)}
              error={errores.piso}
            />
          </div>

          {!sinPropiedadesAun && (
            <label className="flex cursor-pointer items-start gap-2 rounded border border-borde-fuerte p-3">
              <input
                type="checkbox"
                checked={valores.esPrincipal}
                onChange={(e) => cambiar("esPrincipal", e.target.checked)}
                className="mt-0.5 size-4 accent-[color:var(--expediente)]"
              />
              <span>
                <span className="font-medium text-tinta">Que sea la sede o domicilio principal</span>
                <span className="block text-sm text-apagado">
                  Reemplaza al anterior domicilio principal como sede legal de la organización.
                </span>
              </span>
            </label>
          )}

          {sinPropiedadesAun && (
            <p className="text-sm text-apagado">
              Como es la primera propiedad de la empresa, queda como domicilio principal.
            </p>
          )}

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
              {enviando ? "Guardando…" : "Agregar propiedad"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}

