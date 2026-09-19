import { useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2 } from "lucide-react";
import { listarRepresentaciones } from "@/lib/api/endpoints/personas";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { formatearFecha } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { ALCANCES_REPRESENTACION, etiquetaDe } from "@/lib/dominio/listasBlancas";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Cargando, ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { Button } from "@/componentes/ui/button";
import { Card, CardCuerpo } from "@/componentes/ui/card";

/**
 * Las organizaciones del titular.
 *
 * Se arma con `GET /personas/{sub}/representaciones`, que es la consulta directa
 * que existe. **No hay endpoint "organizaciones donde soy dueño"** (ver
 * issues.md, punto 6), así que la titularidad se resuelve al entrar al detalle:
 * ahí sí viene la lista de dueños.
 */
export function MisOrganizaciones() {
  const { id } = useSesion();
  const representaciones = useRecurso(useCallback((s) => listarRepresentaciones(id, s), [id]));

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo="Mis organizaciones"
        descripcion="Aquellas en las que podés actuar en nombre de la organización."
        acciones={
          <Button asChild>
            <Link to="/portal/organizaciones/nueva">
              <Building2 aria-hidden="true" />
              Registrar una
            </Link>
          </Button>
        }
      />

      {representaciones.cargando && <Cargando />}
      {representaciones.error && (
        <ErrorEnPantalla
          error={representaciones.error}
          alReintentar={representaciones.recargar}
        />
      )}

      {representaciones.datos?.length === 0 && (
        <Card>
          <CardCuerpo>
            <EstadoVacio
              titulo="No representás a ninguna organización"
              descripcion="Si sos dueño o apoderado de una empresa o comercio, alguien de la organización tiene que otorgarte la representación."
              accion={
                <Button asChild variante="secundario">
                  <Link to="/portal/organizaciones/nueva">Registrar una organización</Link>
                </Button>
              }
            />
          </CardCuerpo>
        </Card>
      )}

      {representaciones.datos?.length > 0 && (
        <ul className="lista-escalonada flex flex-col gap-u2">
          {representaciones.datos.map((r) => (
            <li key={r.representacionId}>
              <Card>
                <CardCuerpo>
                  <Link
                    to={`/portal/organizaciones/${r.organizacionId}`}
                    className="group flex flex-wrap items-start justify-between gap-u2"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-u2">
                        <span className="font-medium text-expediente group-hover:underline">
                          {r.razonSocial}
                        </span>
                        <BadgeEstado entidad={ENTIDADES.REPRESENTACION} estado={r.estado} />
                      </span>
                      <span className="block text-[length:var(--texto-dato)] text-apagado">
                        Alcance {etiquetaDe(ALCANCES_REPRESENTACION, r.alcance).toLowerCase()} ·
                        desde el {formatearFecha(r.desde)}
                        {r.hasta ? ` hasta el ${formatearFecha(r.hasta)}` : " · sin vencimiento"}
                      </span>
                    </span>
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
