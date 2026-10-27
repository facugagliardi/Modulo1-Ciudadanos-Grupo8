import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CircleDashed, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { cambiarEstadoCiudadano, obtenerCiudadano } from "@/lib/api/endpoints/ciudadanos";
import { listarDocumentos, listarDomicilios } from "@/lib/api/endpoints/ciudadanos";
import { listarRelaciones } from "@/lib/api/endpoints/relaciones";
import { ListaDocumentos, SubirDocumento } from "@/componentes/documentacion/ListaDocumentos";
import { Button } from "@/componentes/ui/button";
import { useRecurso } from "@/lib/useRecurso";
import { edad, formatearFecha, nombreCompleto } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { etiquetaDe, TIPOS_PROPIEDAD, TIPOS_RELACION } from "@/lib/dominio/listasBlancas";
import { PERMISOS } from "@/lib/auth/permisos";
import { usePermiso } from "@/lib/auth/SesionContext";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { CambiarEstado } from "@/componentes/CambiarEstado";
import { ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { ConEsqueleto } from "@/componentes/Esqueleto";
import { Identificador } from "@/componentes/Identificador";
import { Card, CardCuerpo, CardEncabezado, CardTitulo } from "@/componentes/ui/card";
import {
  ContadorDePestania,
  ListaPestanias,
  PanelPestania,
  Pestania,
  Pestanias,
} from "@/componentes/ui/tabs";

/**
 * El legajo de una ciudadano: todo lo que el municipio sabe de ella, en un lugar.
 *
 * Cada bloque se carga por separado a propósito. Si fallan las relaciones, el
 * legajo igual muestra los datos y los domicilios; un error parcial no deja la
 * pantalla en blanco.
 */
/** El legajo de la primera carga: largos típicos para que el esqueleto tenga su forma. */
const LEGAJO_DE_EJEMPLO = {
  id: 1,
  nombre: "Nombre",
  apellido: "Apellido",
  fechaNacimiento: "1990-01-01",
  dni: "30111222",
  cuil: "20301112223",
  estado: "ACTIVO",
  contactos: [],
};

export function LegajoVecino() {
  const { id } = useParams();
  const puedeCambiarEstado = usePermiso(PERMISOS.CAMBIAR_ESTADO_TITULAR);

  const puedeEditar = usePermiso(PERMISOS.EDITAR_TERCEROS);
  const puedeValidar = usePermiso(PERMISOS.VALIDAR_DOCUMENTACION);

  const ciudadano = useRecurso(useCallback((s) => obtenerCiudadano(id, s), [id]));
  const domicilios = useRecurso(useCallback((s) => listarDomicilios(id, s), [id]));
  const relaciones = useRecurso(useCallback((s) => listarRelaciones(id, s), [id]));
  const documentos = useRecurso(useCallback((s) => listarDocumentos(id, s), [id]));

  return (
    <>
      <Link
        to="/admin/padron"
        className="mb-u2 inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] text-apagado hover:text-expediente"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver al padrón
      </Link>

      {ciudadano.error && <ErrorEnPantalla error={ciudadano.error} alReintentar={ciudadano.recargar} />}

      <ConEsqueleto
        recurso={ciudadano}
        clave={`legajo:${id}`}
        ejemplo={LEGAJO_DE_EJEMPLO}
        etiqueta="Buscando el legajo…"
      >
        {(c) => (
          <>
            <header className="mb-u3 flex flex-wrap items-start justify-between gap-u2 border-b border-borde pb-u3">
              <div className="min-w-0">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-apagado">
                  Legajo de vecino
                </p>
                <h1 className="flex flex-wrap items-center gap-u2">
                  {nombreCompleto(c) || "Sin nombre"}
                  <BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={c.estado} />
                </h1>
                <dl className="mt-1.5 flex flex-wrap gap-x-u4 gap-y-1 text-[length:var(--texto-dato)] text-apagado">
                  <div className="flex gap-1.5">
                    <dt>DNI</dt>
                    <dd className="text-tinta">
                      <Identificador valor={c.dni} tipo="dni" />
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>CUIL</dt>
                    <dd className="text-tinta">
                      <Identificador valor={c.cuil} tipo="cuit" />
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Ficha</dt>
                    <dd className="text-tinta">
                      <Identificador valor={`#${c.id}`} />
                    </dd>
                  </div>
                </dl>
              </div>

              {puedeCambiarEstado && (
                <CambiarEstado
                  entidad={ENTIDADES.CIUDADANO}
                  estadoActual={c.estado}
                  nombreEntidad="este vecino"
                  alConfirmar={async (nuevo) => {
                    await cambiarEstadoCiudadano(c.id, nuevo);
                    ciudadano.recargar();
                  }}
                />
              )}
            </header>

            <Pestanias defaultValue="datos">
              <ListaPestanias>
                <Pestania value="datos">Datos ciudadanoles</Pestania>
                <Pestania value="domicilios">
                  Domicilios
                  <ContadorDePestania valor={domicilios.datos?.length} />
                </Pestania>
                <Pestania value="contacto">
                  Contacto
                  <ContadorDePestania valor={c.contactos?.length} />
                </Pestania>
                <Pestania value="familia">
                  Grupo familiar
                  <ContadorDePestania valor={relaciones.datos?.length} />
                </Pestania>
                <Pestania value="documentos">
                  Documentos
                  <ContadorDePestania valor={documentos.datos?.length} />
                </Pestania>
              </ListaPestanias>

              {/* --- Datos ciudadanoles --- */}
              <PanelPestania value="datos">
                <Card>
                  <CardCuerpo>
                    <dl className="grid gap-u3 sm:grid-cols-2 lg:grid-cols-3">
                      <Dato etiqueta="Nombre" valor={c.nombre} />
                      <Dato etiqueta="Apellido" valor={c.apellido} />
                      <Dato
                        etiqueta="Fecha de nacimiento"
                        valor={
                          c.fechaNacimiento
                            ? `${formatearFecha(c.fechaNacimiento)} · ${edad(c.fechaNacimiento)} años`
                            : null
                        }
                      />
                      <Dato etiqueta="DNI" valor={<Identificador valor={c.dni} tipo="dni" />} />
                      <Dato etiqueta="CUIL" valor={<Identificador valor={c.cuil} tipo="cuit" />} />
                      <Dato
                        etiqueta="Estado"
                        valor={<BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={c.estado} />}
                      />
                    </dl>
                  </CardCuerpo>
                </Card>

                {c.domicilioPrincipal && (
                  <Card className="mt-u3">
                    <CardEncabezado>
                      <CardTitulo>Domicilio principal</CardTitulo>
                    </CardEncabezado>
                    <CardCuerpo>
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-apagado" aria-hidden="true" />
                        <span>
                          <span className="font-medium">
                            {c.domicilioPrincipal.calle} {c.domicilioPrincipal.numero}
                            {c.domicilioPrincipal.altura ? `, ${c.domicilioPrincipal.altura}` : ""}
                          </span>
                          <span className="block text-[length:var(--texto-dato)] text-apagado">
                            {etiquetaDe(TIPOS_PROPIEDAD, c.domicilioPrincipal.tipo)} · vigente desde{" "}
                            {formatearFecha(c.domicilioPrincipal.vigenteDesde)}
                          </span>
                        </span>
                      </p>
                    </CardCuerpo>
                  </Card>
                )}
              </PanelPestania>

              {/* --- Domicilios: la historia no se pisa, se apila --- */}
              <PanelPestania value="domicilios">
                {domicilios.error && (
                  <ErrorEnPantalla error={domicilios.error} alReintentar={domicilios.recargar} />
                )}
                <ConEsqueleto
                  recurso={domicilios}
                  clave={`domicilios-legajo:${id}`}
                  ejemplo={[]}
                  etiqueta="Cargando los domicilios…"
                >
                  {(lista) => (
                    <>
                      {lista.length === 0 && (
                        <EstadoVacio
                          titulo="Sin domicilios cargados"
                          descripcion="Este vecino todavía no tiene ningún domicilio registrado."
                        />
                      )}
                      {lista.length > 0 && (
                        <ol className="flex flex-col">
                          {lista.map((d, i) => {
                            const vigente = !d.vigenteHasta;
                            return (
                              <li
                                key={d.propiedadId}
                                className={cn(
                                  "relative flex gap-u3 border-l-2 pb-u3 pl-u3",
                                  vigente ? "border-expediente" : "border-borde",
                                  i === lista.length - 1 && "pb-0",
                                )}
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "absolute -left-[5px] top-1.5 size-2 rounded-full",
                                    vigente ? "bg-expediente" : "bg-borde-fuerte",
                                  )}
                                />
                                <div className={cn(!vigente && "opacity-70")}>
                                  <p className="font-medium">
                                    {d.calle} {d.numero}
                                    {(d.piso ?? d.altura) ? `, ${d.piso ?? d.altura}` : ""}
                                    <span
                                      className="ml-2 inline-flex items-center rounded border border-borde-fuerte bg-fondo-elevado px-1.5 py-0.5 font-mono text-[11px] font-semibold text-tinta"
                                      title="ID de propiedad para vincular a una organización"
                                    >
                                      ID: #{d.propiedadId}
                                    </span>
                                    {d.esPrincipal && vigente && (
                                      <span className="ml-2 rounded bg-expediente-suave px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-expediente">
                                        Principal
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[length:var(--texto-dato)] text-apagado">
                                    Código: <strong className="font-mono text-tinta font-semibold">PROP-{d.propiedadId}</strong> · {etiquetaDe(TIPOS_PROPIEDAD, d.tipo)} ·{" "}
                                    {vigente
                                      ? `desde ${formatearFecha(d.vigenteDesde)}`
                                      : `${formatearFecha(d.vigenteDesde)} — ${formatearFecha(d.vigenteHasta)}`}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </>
                  )}
                </ConEsqueleto>
              </PanelPestania>

              {/* --- Contacto --- */}
              <PanelPestania value="contacto">
                {!c.contactos?.length ? (
                  <EstadoVacio
                    titulo="Sin datos de contacto"
                    descripcion="No hay un correo ni un teléfono para avisarle de nada."
                  />
                ) : (
                  <ul className="flex flex-col gap-u1">
                    {c.contactos.map((ct) => (
                      <li
                        key={ct.contactoId}
                        className="flex items-center justify-between gap-u2 rounded border border-borde bg-superficie px-u3 py-u2"
                      >
                        <span>
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-apagado">
                            {ct.tipo === "EMAIL" ? "Correo" : "Teléfono"}
                          </span>
                          <span className="identificador">{ct.valor}</span>
                        </span>
                        {ct.verificado ? (
                          <span className="inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] font-medium text-vigente">
                            <BadgeCheck className="size-4" aria-hidden="true" />
                            Verificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] text-apagado">
                            <CircleDashed className="size-4" aria-hidden="true" />
                            Sin verificar
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </PanelPestania>

              {/* --- Grupo familiar --- */}
              <PanelPestania value="familia">
                {relaciones.error && (
                  <ErrorEnPantalla error={relaciones.error} alReintentar={relaciones.recargar} />
                )}
                <ConEsqueleto
                  recurso={relaciones}
                  clave={`familia-legajo:${id}`}
                  ejemplo={[]}
                  etiqueta="Cargando el grupo familiar…"
                >
                  {(lista) => (
                    <>
                      {lista.length === 0 && (
                        <EstadoVacio
                          titulo="Sin vínculos registrados"
                          descripcion="Este vecino no tiene familiares ni responsables cargados."
                        />
                      )}
                      {lista.length > 0 && (
                        <ul className="flex flex-col gap-u1">
                          {lista.map((r) => (
                            <li
                              key={r.relacionId}
                              className="flex items-center justify-between gap-u2 rounded border border-borde bg-superficie px-u3 py-u2"
                            >
                              <span>
                                <Link
                                  to={`/admin/padron/${r.ciudadanoRelacionadoId}`}
                                  className="font-medium text-expediente hover:underline"
                                >
                                  {[r.nombre, r.apellido].filter(Boolean).join(" ") ||
                                    `Vecino #${r.ciudadanoRelacionadoId}`}
                                </Link>
                                <span className="block text-[length:var(--texto-dato)] text-apagado">
                                  {etiquetaDe(TIPOS_RELACION, r.tipoRelacion)}
                                </span>
                              </span>
                              {r.esResponsable && (
                                <span className="rounded bg-alerta-suave px-2 py-0.5 text-xs font-semibold text-alerta">
                                  Responsable
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </ConEsqueleto>
              </PanelPestania>

              {/* --- Documentos: acá se valida --- */}
              <PanelPestania value="documentos">
                {documentos.error && (
                  <ErrorEnPantalla error={documentos.error} alReintentar={documentos.recargar} />
                )}
                <ConEsqueleto
                  recurso={documentos}
                  clave={`documentos-legajo:${id}`}
                  ejemplo={[]}
                  etiqueta="Cargando los documentos…"
                >
                  {(lista) => (
                    <>
                      {puedeEditar && lista.length > 0 && (
                        <div className="mb-u2 flex justify-end">
                          <SubirDocumento ciudadanoId={Number(id)} alGuardar={documentos.recargar}>
                            <Button variante="secundario" tamano="chico">
                              Subir documento
                            </Button>
                          </SubirDocumento>
                        </div>
                      )}
                      <ListaDocumentos
                        ciudadanoId={Number(id)}
                        documentos={lista}
                        puedeSubir={puedeEditar}
                        puedeValidar={puedeValidar}
                        alCambiar={documentos.recargar}
                        vacio={{
                          titulo: "Sin documentación cargada",
                          descripcion:
                            "Este vecino todavía no subió ningún documento. Podés pedirle uno desde Documentación.",
                        }}
                      />
                    </>
                  )}
                </ConEsqueleto>
              </PanelPestania>
            </Pestanias>
          </>
        )}
      </ConEsqueleto>
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
