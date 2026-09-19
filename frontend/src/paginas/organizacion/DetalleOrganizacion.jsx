import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Trash2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  actualizarOrganizacion,
  agregarDueno,
  cambiarEstadoOrganizacion,
  obtenerOrganizacion,
  quitarDueno,
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
import { BuscadorDePersona, PersonaElegida } from "@/componentes/BuscadorDePersona";
import { CambiarEstado } from "@/componentes/CambiarEstado";
import { ConfirmarAccion } from "@/componentes/ConfirmarAccion";
import { Cargando, ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { Identificador } from "@/componentes/Identificador";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
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

  const organizacion = useRecurso(useCallback((s) => obtenerOrganizacion(id, s), [id]));
  const representaciones = useRecurso(
    useCallback((s) => listarRepresentacionesDeOrganizacion(id, s), [id]),
  );

  const o = organizacion.datos;
  const esDueno = Boolean(o?.duenos?.some((d) => d.personaId === miId));
  const esRepresentante = Boolean(o?.representantesVigentes?.some((r) => r.personaId === miId));
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
                      {o.domicilioPrincipal.altura ? `, ${o.domicilioPrincipal.altura}` : ""}
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
                    <li key={d.personaId}>
                      <Card>
                        <CardCuerpo className="flex flex-wrap items-center justify-between gap-u2">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {zona === "admin" && puedeEditarTerceros ? (
                                <Link
                                  to={`/admin/padron/${d.personaId}`}
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
                              <ConfirmarAccion
                                titulo="Quitar a este dueño"
                                descripcion={`${[d.nombre, d.apellido].filter(Boolean).join(" ")} deja de figurar como titular. Sus datos personales no se tocan.`}
                                textoConfirmar="Quitar dueño"
                                alConfirmar={async () => {
                                  await quitarDueno(o.organizacionId, d.personaId);
                                  organizacion.recargar();
                                }}
                                disparador={
                                  <Button
                                    variante="fantasma"
                                    tamano="chico"
                                    aria-label={`Quitar a ${d.nombre} ${d.apellido}`}
                                  >
                                    <Trash2 aria-hidden="true" />
                                  </Button>
                                }
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
                                `Persona #${r.personaId}`}
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

function AgregarDueno({ organizacion, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [persona, setPersona] = useState(null);
  const [porcentaje, setPorcentaje] = useState("");
  const [errorPorcentaje, setErrorPorcentaje] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // El backend rechaza con 409 si la suma supera 100. Se avisa antes.
  const asignado = (organizacion.duenos ?? []).reduce(
    (t, d) => t + Number(d.porcentajeTitularidad ?? 0),
    0,
  );
  const disponible = Math.max(0, 100 - asignado);

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    const num = porcentaje === "" ? null : Number(porcentaje);
    if (num !== null) {
      if (Number.isNaN(num) || num <= 0 || num > 100) {
        setErrorPorcentaje("Tiene que ser un número entre 0,01 y 100.");
        return;
      }
      if (num > disponible) {
        setErrorPorcentaje(`Sólo queda ${disponible}% sin asignar.`);
        return;
      }
    }
    setEnviando(true);
    try {
      await agregarDueno(organizacion.organizacionId, {
        personaId: persona.id,
        porcentajeTitularidad: num ?? undefined,
      });
      alGuardar?.();
      setAbierto(false);
      setPersona(null);
      setPorcentaje("");
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
          setPersona(null);
          setPorcentaje("");
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
        descripcion="Tiene que ser una persona ya registrada en el municipio."
      >
        {!persona ? (
          <BuscadorDePersona etiqueta="DNI del nuevo dueño" alEncontrar={setPersona} autoFocus />
        ) : (
          <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
            <PersonaElegida
              persona={persona}
              etiqueta="Nuevo dueño"
              alCambiar={() => setPersona(null)}
            />

            <Campo
              etiqueta="Porcentaje de titularidad"
              type="number"
              step="0.01"
              min="0.01"
              max={disponible || 100}
              ayuda={
                asignado > 0
                  ? `Hay ${asignado}% asignado. Queda ${disponible}% disponible. Podés dejarlo vacío.`
                  : "Opcional."
              }
              value={porcentaje}
              onChange={(e) => {
                setPorcentaje(e.target.value);
                setErrorPorcentaje(null);
              }}
              error={errorPorcentaje}
            />

            {errorGeneral && (
              <p
                role="alert"
                className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
              >
                {errorGeneral.status === 409
                  ? "Esa persona ya es dueña, o la suma de titularidades supera el 100%."
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
  const [persona, setPersona] = useState(null);
  const hoy = new Date().toISOString().slice(0, 10);
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
        personaId: persona.id,
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
          setPersona(null);
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
        descripcion="La persona va a poder hacer trámites en nombre de la organización ante otras áreas."
      >
        {!persona ? (
          <BuscadorDePersona etiqueta="DNI del representante" alEncontrar={setPersona} autoFocus />
        ) : (
          <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
            <PersonaElegida
              persona={persona}
              etiqueta="Representante"
              alCambiar={() => setPersona(null)}
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
              <Campo
                etiqueta="Desde"
                obligatorio
                type="date"
                value={valores.desde}
                onChange={(e) => {
                  setValores((v) => ({ ...v, desde: e.target.value }));
                  setErrores({});
                }}
                error={errores.desde}
              />
              <Campo
                etiqueta="Hasta"
                type="date"
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
                  ? "Esa persona ya tiene una representación activa en esta organización."
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
