import { useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { listarExpedientes } from "@/lib/api/endpoints/expedientes";
import { useRecurso } from "@/lib/useRecurso";
import { formatearFecha } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Cargando, ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { Identificador } from "@/componentes/Identificador";
import { Card, CardCuerpo } from "@/componentes/ui/card";

/**
 * Los expedientes del vecino.
 *
 * Sin el permiso LEER_TERCEROS el backend ya devuelve sólo los propios, así
 * que acá no hace falta filtrar nada: lo que llega es lo que corresponde.
 *
 * A diferencia del listado del backoffice, no lleva tabla: un vecino tiene
 * dos o tres expedientes en su vida, y una tabla con buscador para tres filas
 * es ceremonia sin sentido.
 */
export function MisExpedientes() {
  const expedientes = useRecurso(useCallback((s) => listarExpedientes(s), []));

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo="Mis expedientes"
        descripcion="Los trámites formales que el municipio abrió a tu nombre."
      />

      {expedientes.cargando && <Cargando />}
      {expedientes.error && (
        <ErrorEnPantalla error={expedientes.error} alReintentar={expedientes.recargar} />
      )}

      {expedientes.datos?.length === 0 && (
        <Card>
          <CardCuerpo>
            <EstadoVacio
              titulo="No tenés expedientes"
              descripcion="Los expedientes los inicia el municipio cuando hacés un trámite. Cuando abran uno a tu nombre, va a aparecer acá."
            />
          </CardCuerpo>
        </Card>
      )}

      {expedientes.datos?.length > 0 && (
        <ul className="lista-escalonada flex flex-col gap-u2">
          {expedientes.datos.map((e) => (
            <li key={e.expedienteId}>
              <Card>
                <CardCuerpo>
                  <Link
                    to={`/portal/expedientes/${e.expedienteId}`}
                    className="group flex flex-wrap items-start justify-between gap-u2"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-u2">
                        <Identificador valor={e.numero} className="text-sm" />
                        <BadgeEstado entidad={ENTIDADES.EXPEDIENTE} estado={e.estado} />
                      </span>
                      <span className="mt-1 block font-medium text-expediente group-hover:underline">
                        {e.caratula}
                      </span>
                      <span className="block text-[length:var(--texto-dato)] text-apagado">
                        {e.areaIniciadora} · iniciado el {formatearFecha(e.fechaInicio)} ·{" "}
                        {e.actuacionesCount === 1
                          ? "1 actuación"
                          : `${e.actuacionesCount ?? 0} actuaciones`}
                      </span>
                    </span>
                    {/* Se mueve la flecha, no la tarjeta: si se moviera el
                        elemento con hover, el cursor podría salirse del área y
                        el estado parpadearía. */}
                    <ArrowRight
                      className="mt-1 size-4 shrink-0 text-apagado transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-expediente"
                      aria-hidden="true"
                    />
                  </Link>
                </CardCuerpo>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
