import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, FileWarning } from "lucide-react";
import { listarCiudadanos } from "@/lib/api/endpoints/ciudadanos";
import { listarOrganizaciones } from "@/lib/api/endpoints/organizaciones";
import { listarExpedientes } from "@/lib/api/endpoints/expedientes";
import { listarSolicitudes } from "@/lib/api/endpoints/documentacion";
import { useRecurso } from "@/lib/useRecurso";
import { diasHasta } from "@/lib/dominio/formato";
import { ENTIDADES, etiquetaEstado } from "@/lib/dominio/estados";
import { etiquetaDe, TIPOS_ORGANIZACION } from "@/lib/dominio/listasBlancas";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Cargando, ErrorEnPantalla } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { GraficoBarras, Indicador } from "@/componentes/tablero/GraficoBarras";
import { Button } from "@/componentes/ui/button";

/**
 * El tablero del backoffice.
 *
 * Se arma **enteramente en el front**, agregando en memoria los cuatro listados
 * que el backend ya devuelve completos. No hay endpoint de métricas, y tampoco
 * hace falta: la restricción de que los listados no filtren, que en las tablas
 * es un costo, acá sale gratis.
 *
 * El orden de la pantalla es deliberado: primero lo que reclama una acción
 * —trabajo estancado, plazos vencidos—, después la composición del registro. Un
 * responsable de área entra a saber qué falta hacer, no a mirar totales.
 *
 * Dos métricas del plan quedaron afuera porque el backend no las permite:
 * documentos pendientes de validación y representaciones por vencer. Ninguna de
 * las dos tiene listado global. Ver issues.md, puntos 5 y 14.
 */
export function Tablero() {
  const ciudadanos = useRecurso(useCallback((s) => listarCiudadanos(s), []));
  const organizaciones = useRecurso(useCallback((s) => listarOrganizaciones(s), []));
  const expedientes = useRecurso(useCallback((s) => listarExpedientes(s), []));
  const solicitudes = useRecurso(useCallback((s) => listarSolicitudes(s), []));

  const metricas = useMemo(
    () =>
      calcularMetricas({
        ciudadanos: ciudadanos.datos ?? [],
        organizaciones: organizaciones.datos ?? [],
        expedientes: expedientes.datos ?? [],
        solicitudes: solicitudes.datos ?? [],
      }),
    [ciudadanos.datos, organizaciones.datos, expedientes.datos, solicitudes.datos],
  );

  const cargandoTodo =
    ciudadanos.cargando && organizaciones.cargando && expedientes.cargando && solicitudes.cargando;

  // Si una sola consulta falla, el resto del tablero se sigue viendo.
  const fallos = [
    ciudadanos.error && { que: "el padrón", recurso: ciudadanos },
    organizaciones.error && { que: "las organizaciones", recurso: organizaciones },
    expedientes.error && { que: "los expedientes", recurso: expedientes },
    solicitudes.error && { que: "la documentación", recurso: solicitudes },
  ].filter(Boolean);

  return (
    <>
      <Encabezado
        seccion="Gestión interna"
        titulo="Tablero"
        descripcion="El estado del registro municipal y lo que está esperando una decisión."
      />

      {cargandoTodo && <Cargando texto="Calculando indicadores…" />}

      {fallos.length > 0 && (
        <div className="mb-u3 rounded border border-sello bg-sello-suave px-u3 py-u2" role="alert">
          <p className="font-medium text-sello">
            No pudimos cargar {fallos.map((f) => f.que).join(", ")}. El resto del tablero está
            calculado con lo que sí llegó.
          </p>
          <Button
            variante="secundario"
            tamano="chico"
            className="mt-u2"
            onClick={() => fallos.forEach((f) => f.recurso.recargar())}
          >
            Reintentar
          </Button>
        </div>
      )}

      {!cargandoTodo && (
        <>
          {/* La cifra que encabeza: de qué tamaño es el registro. */}
          <div className="mb-u3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-apagado">
              Padrón municipal
            </p>
            <p className="text-5xl font-semibold leading-none text-tinta">
              {metricas.totalVecinos.toLocaleString("es-AR")}
            </p>
            <p className="mt-1.5 text-apagado">
              {metricas.vecinosActivos.toLocaleString("es-AR")} activos ·{" "}
              {metricas.totalOrganizaciones.toLocaleString("es-AR")}{" "}
              {metricas.totalOrganizaciones === 1 ? "organización" : "organizaciones"} ·{" "}
              {metricas.totalExpedientes.toLocaleString("es-AR")}{" "}
              {metricas.totalExpedientes === 1 ? "expediente" : "expedientes"}
            </p>
          </div>

          {/* --- Lo que reclama una acción --- */}
          <h2 className="mb-u2">Requiere atención</h2>
          <div className="mb-u4 grid gap-u2 sm:grid-cols-2 lg:grid-cols-3">
            <Indicador
              etiqueta="Expedientes sin ninguna actuación"
              valor={metricas.expedientesEstancados}
              severidad={metricas.expedientesEstancados > 0 ? "atencion" : "buena"}
              icono={FileWarning}
              detalle={
                metricas.expedientesEstancados > 0
                  ? "Están abiertos y nadie registró nada todavía."
                  : "Todos los expedientes abiertos tienen movimiento."
              }
              accion={
                metricas.expedientesEstancados > 0 && (
                  <Button asChild variante="secundario" tamano="chico">
                    <Link to="/admin/expedientes">Ver expedientes</Link>
                  </Button>
                )
              }
            />

            <Indicador
              etiqueta="Documentación con el plazo vencido"
              valor={metricas.solicitudesVencidas}
              severidad={metricas.solicitudesVencidas > 0 ? "grave" : "buena"}
              icono={AlertTriangle}
              detalle={
                metricas.solicitudesVencidas > 0
                  ? "Se pidieron y el plazo ya pasó, pero siguen pendientes."
                  : "Ninguna solicitud pendiente pasó su plazo."
              }
              accion={
                metricas.solicitudesVencidas > 0 && (
                  <Button asChild variante="secundario" tamano="chico">
                    <Link to="/admin/documentacion">Ver documentación</Link>
                  </Button>
                )
              }
            />

            <Indicador
              etiqueta="Documentación que vence esta semana"
              valor={metricas.solicitudesPorVencer}
              severidad={metricas.solicitudesPorVencer > 0 ? "atencion" : "buena"}
              icono={Clock}
              detalle={
                metricas.solicitudesPorVencer > 0
                  ? "Vencen en los próximos siete días."
                  : "Nada vence en los próximos siete días."
              }
            />
          </div>

          {/* --- Cómo está compuesto el registro --- */}
          <h2 className="mb-u2">Composición</h2>
          <div className="grid gap-u3 lg:grid-cols-2">
            <GraficoBarras
              titulo="Vecinos por estado"
              descripcion="Todo el padrón, agrupado por su situación registral."
              unidad="Estado"
              datos={metricas.vecinosPorEstado}
              vacio="El padrón está vacío"
            />

            <GraficoBarras
              titulo="Expedientes por estado"
              descripcion="Dónde está parado cada trámite formal."
              unidad="Estado"
              datos={metricas.expedientesPorEstado}
              vacio="No hay expedientes"
            />

            <GraficoBarras
              titulo="Expedientes por área iniciadora"
              descripcion="Qué áreas del municipio están abriendo trámites."
              unidad="Área"
              datos={metricas.expedientesPorArea}
              vacio="No hay expedientes"
            />

            <GraficoBarras
              titulo="Organizaciones por tipo"
              descripcion="Empresas, comercios y asociaciones registradas."
              unidad="Tipo"
              datos={metricas.organizacionesPorTipo}
              vacio="No hay organizaciones registradas"
            />
          </div>

          <p className="mt-u4 max-w-prose text-sm text-apagado">
            Los indicadores se calculan sobre los listados completos que devuelve la API, así
            que reflejan el estado del momento en que se abrió la pantalla.
          </p>
        </>
      )}
    </>
  );
}

/**
 * Toda la aritmética del tablero, separada de la pantalla para poder probarla
 * sin renderizar nada.
 */
export function calcularMetricas({ ciudadanos, organizaciones, expedientes, solicitudes }) {
  const contarPor = (lista, clave) =>
    lista.reduce((acc, item) => {
      const k = item[clave] ?? "SIN_DATO";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  const aFilasDeEstado = (conteo, entidad, orden) =>
    orden
      .filter((estado) => conteo[estado])
      .map((estado) => ({
        clave: estado,
        valor: conteo[estado],
        etiqueta: <BadgeEstado entidad={entidad} estado={estado} />,
        etiquetaTexto: etiquetaEstado(estado),
      }));

  const porEstadoCiudadano = contarPor(ciudadanos, "estado");
  const porEstadoExpediente = contarPor(expedientes, "estado");
  const porArea = contarPor(expedientes, "areaIniciadora");
  const porTipoOrg = contarPor(organizaciones, "tipo");

  // Ordenados de mayor a menor: la comparación de magnitud es el trabajo del
  // gráfico, y una lista sin orden lo esconde.
  const aFilasNominales = (conteo, etiquetar = (k) => k) =>
    Object.entries(conteo)
      .sort(([, a], [, b]) => b - a)
      .map(([clave, valor]) => ({ clave, valor, etiqueta: etiquetar(clave), etiquetaTexto: etiquetar(clave) }));

  const pendientes = solicitudes.filter((s) => s.estado === "PENDIENTE");

  return {
    totalVecinos: ciudadanos.length,
    vecinosActivos: ciudadanos.filter((c) => c.estado === "ACTIVO").length,
    totalOrganizaciones: organizaciones.length,
    totalExpedientes: expedientes.length,

    // Trabajo estancado: abierto y sin que nadie haya hecho nada. Un archivado
    // sin actuaciones no está estancado, está cerrado.
    expedientesEstancados: expedientes.filter(
      (e) => !e.actuacionesCount && e.estado !== "ARCHIVADO",
    ).length,

    solicitudesVencidas: pendientes.filter((s) => {
      const d = diasHasta(s.plazo);
      return d !== null && d < 0;
    }).length,

    solicitudesPorVencer: pendientes.filter((s) => {
      const d = diasHasta(s.plazo);
      return d !== null && d >= 0 && d <= 7;
    }).length,

    // El orden de los estados no es alfabético: sigue el recorrido real.
    vecinosPorEstado: aFilasDeEstado(porEstadoCiudadano, ENTIDADES.CIUDADANO, [
      "ACTIVO",
      "INACTIVO",
      "BLOQUEADO",
      "FALLECIDO",
    ]),
    expedientesPorEstado: aFilasDeEstado(porEstadoExpediente, ENTIDADES.EXPEDIENTE, [
      "INICIADO",
      "EN_TRAMITE",
      "RESUELTO",
      "ARCHIVADO",
    ]),

    expedientesPorArea: aFilasNominales(porArea),
    organizacionesPorTipo: aFilasNominales(porTipoOrg, (t) => etiquetaDe(TIPOS_ORGANIZACION, t)),
  };
}
