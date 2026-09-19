import { useCallback } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Building2, FileText, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { obtenerCiudadano } from "@/lib/api/endpoints/ciudadanos";
import { listarDomicilios, listarRepresentaciones } from "@/lib/api/endpoints/personas";
import { listarSolicitudes } from "@/lib/api/endpoints/documentacion";
import { listarExpedientes } from "@/lib/api/endpoints/expedientes";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { diasHasta, formatearFecha, nombreCompleto } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Cargando, EstadoVacio } from "@/componentes/Estados";
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

  const persona = useRecurso(
    useCallback((s) => (esCiudadano ? obtenerCiudadano(id, s) : Promise.resolve(null)), [id, esCiudadano]),
  );
  const domicilios = useRecurso(useCallback((s) => listarDomicilios(id, s), [id]));
  const solicitudes = useRecurso(useCallback((s) => listarSolicitudes(s), []));
  const expedientes = useRecurso(useCallback((s) => listarExpedientes(s), []));
  const representaciones = useRecurso(useCallback((s) => listarRepresentaciones(id, s), [id]));

  const pendientes = (solicitudes.datos ?? []).filter((s) => s.estado === "PENDIENTE");
  const contactos = persona.datos?.contactos ?? [];
  const vigentes = (domicilios.datos ?? []).filter((d) => !d.vigenteHasta);

  // Lo que le falta al vecino para tener el legajo en condiciones.
  const pendientesDeCarga = [
    vigentes.length === 0 && {
      texto: "Todavía no cargaste tu domicilio",
      a: "/portal/domicilios",
      accion: "Cargar domicilio",
    },
    esCiudadano && contactos.length === 0 && {
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

  const cargandoTodo =
    persona.cargando && domicilios.cargando && solicitudes.cargando && expedientes.cargando;

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo={
          persona.datos ? `Hola, ${persona.datos.nombre}` : esJuridica ? "Mis trámites" : "Mis trámites"
        }
        descripcion="Acá ves tus datos, lo que el municipio te pide y el estado de tus expedientes."
        acciones={
          persona.datos && (
            <BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={persona.datos.estado} />
          )
        }
      />

      {cargandoTodo && <Cargando texto="Buscando tus trámites…" />}

      {/* --- Lo que reclama atención va primero --- */}
      {pendientes.length > 0 && (
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
                <div
                  key={s.solicitudId}
                  className="flex flex-wrap items-center justify-between gap-u2"
                >
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
      )}

      {pendientesDeCarga.length > 0 && (
        <Card className="mb-u3">
          <CardEncabezado>
            <CardTitulo>Completá tu legajo</CardTitulo>
          </CardEncabezado>
          <CardCuerpo className="flex flex-col gap-u2">
            {pendientesDeCarga.map((p) => (
              <div key={p.a + p.texto} className="flex flex-wrap items-center justify-between gap-u2">
                <p className="text-apagado">{p.texto}</p>
                <Button asChild variante="secundario" tamano="chico">
                  <Link to={p.a}>{p.accion}</Link>
                </Button>
              </div>
            ))}
          </CardCuerpo>
        </Card>
      )}

      <div className="grid gap-u3 md:grid-cols-2">
        {/* --- Mis datos --- */}
        {persona.datos && (
          <Bloque
            icono={Users}
            titulo="Mis datos"
            a="/portal/perfil"
            textoEnlace="Ver y editar"
          >
            <p className="font-medium">{nombreCompleto(persona.datos)}</p>
            <dl className="mt-1 flex flex-wrap gap-x-u3 gap-y-1 text-[length:var(--texto-dato)] text-apagado">
              <div className="flex gap-1.5">
                <dt>DNI</dt>
                <dd className="text-tinta">
                  <Identificador valor={persona.datos.dni} tipo="dni" />
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>CUIL</dt>
                <dd className="text-tinta">
                  <Identificador valor={persona.datos.cuil} tipo="cuit" />
                </dd>
              </div>
            </dl>
          </Bloque>
        )}

        {/* --- Domicilio --- */}
        <Bloque
          icono={MapPin}
          titulo="Mi domicilio"
          a="/portal/domicilios"
          textoEnlace={vigentes.length ? "Ver historial" : "Cargar"}
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
                    {principal.altura ? `, ${principal.altura}` : ""}
                  </p>
                  <p className="text-[length:var(--texto-dato)] text-apagado">
                    Vigente desde el {formatearFecha(principal.vigenteDesde)}
                    {vigentes.length > 1 && ` · ${vigentes.length} domicilios vigentes`}
                  </p>
                </>
              );
            })()
          )}
        </Bloque>

        {/* --- Expedientes --- */}
        <Bloque
          icono={FileText}
          titulo="Mis expedientes"
          a="/portal/expedientes"
          textoEnlace="Ver todos"
        >
          {expedientes.cargando ? (
            <p className="text-apagado">Cargando…</p>
          ) : (expedientes.datos ?? []).length === 0 ? (
            <p className="text-apagado">No tenés expedientes abiertos.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {expedientes.datos.slice(0, 3).map((e) => (
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

        {/* --- Organizaciones --- */}
        <Bloque
          icono={Building2}
          titulo="Mis organizaciones"
          a="/portal/organizaciones"
          textoEnlace="Ver todas"
        >
          {representaciones.cargando ? (
            <p className="text-apagado">Cargando…</p>
          ) : (representaciones.datos ?? []).length === 0 ? (
            <p className="text-apagado">No representás a ninguna organización.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {representaciones.datos.slice(0, 3).map((r) => (
                <li key={r.representacionId} className="flex items-center justify-between gap-u2">
                  <span className="min-w-0 truncate">{r.razonSocial}</span>
                  <BadgeEstado entidad={ENTIDADES.REPRESENTACION} estado={r.estado} />
                </li>
              ))}
            </ul>
          )}
        </Bloque>
      </div>

      {!cargandoTodo &&
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
