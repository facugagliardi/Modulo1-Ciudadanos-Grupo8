import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  cambiarEstadoExpediente,
  listarActuaciones,
  obtenerExpediente,
} from "@/lib/api/endpoints/expedientes";
import { obtenerCiudadano } from "@/lib/api/endpoints/ciudadanos";
import { useRecurso } from "@/lib/useRecurso";
import { usePermiso } from "@/lib/auth/SesionContext";
import { PERMISOS } from "@/lib/auth/permisos";
import { ErrorEnPantalla } from "@/componentes/Estados";
import { ConEsqueleto } from "@/componentes/Esqueleto";
import { CambiarEstado } from "@/componentes/CambiarEstado";
import { ENTIDADES } from "@/lib/dominio/estados";
import { Caratula } from "@/componentes/expediente/Caratula";
import { Actuaciones } from "@/componentes/expediente/Actuaciones";

/**
 * El expediente, con su carátula y su historia.
 *
 * La misma pantalla sirve al vecino y al backoffice: el expediente es el mismo
 * documento y no tiene sentido contarlo de dos formas distintas. Lo que cambia
 * es qué se puede hacer con él, y eso lo deciden los permisos.
 */
/** El expediente de la primera carga: largos típicos para que el esqueleto tenga su forma. */
const EXPEDIENTE_DE_EJEMPLO = {
  expedienteId: 0,
  numero: "EXP-2026-000000",
  estado: "INICIADO",
  caratula: "Carátula del expediente, con el largo de una de verdad",
  ciudadanoId: 0,
  areaIniciadora: "Mesa de entradas",
  fechaInicio: "2026-01-01T10:00:00",
  actuacionesCount: 0,
};

export function DetalleExpediente({ zona = "portal" }) {
  const { id } = useParams();
  const puedeGestionar = usePermiso(PERMISOS.GESTIONAR_EXPEDIENTES);
  const puedeCambiarEstado = usePermiso(PERMISOS.CAMBIAR_ESTADO_EXPEDIENTE);
  const puedeLeerTerceros = usePermiso(PERMISOS.LEER_TERCEROS);

  const expediente = useRecurso(useCallback((s) => obtenerExpediente(id, s), [id]));
  const actuaciones = useRecurso(useCallback((s) => listarActuaciones(id, s), [id]));

  const ciudadanoId = expediente.datos?.ciudadanoId;
  // El titular puede ser una ciudadano jurídica, y para esas no hay endpoint de
  // consulta: si falla, se muestra el número de ciudadano y listo.
  const titular = useRecurso(
    useCallback(
      (s) => (ciudadanoId ? obtenerCiudadano(ciudadanoId, s).catch(() => null) : Promise.resolve(null)),
      [ciudadanoId],
    ),
  );

  const volverA = zona === "admin" ? "/admin/expedientes" : "/portal/expedientes";
  const lista = actuaciones.datos ?? [];

  return (
    <>
      <Link
        to={volverA}
        className="mb-u2 inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] text-apagado hover:text-expediente"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a expedientes
      </Link>

      {expediente.error && (
        <ErrorEnPantalla error={expediente.error} alReintentar={expediente.recargar} />
      )}

      <ConEsqueleto
        recurso={expediente}
        clave={`expediente:${id}`}
        ejemplo={EXPEDIENTE_DE_EJEMPLO}
        etiqueta="Buscando el expediente…"
      >
        {(exp) => (
          <>
            <Caratula
              expediente={exp}
              titular={titular.datos}
              enlaceTitular={
                zona === "admin" && puedeLeerTerceros ? `/admin/padron/${ciudadanoId}` : null
              }
              acciones={
                puedeCambiarEstado && (
                  <CambiarEstado
                    entidad={ENTIDADES.EXPEDIENTE}
                    estadoActual={exp.estado}
                    nombreEntidad="este expediente"
                    // Regla del alcance que el backend todavía no valida: un
                    // expediente no debería resolverse sin ninguna actuación.
                    destinosBloqueados={
                      lista.length === 0
                        ? { RESUELTO: "Necesita al menos una actuación" }
                        : {}
                    }
                    alConfirmar={async (nuevo) => {
                      await cambiarEstadoExpediente(exp.expedienteId, nuevo);
                      expediente.recargar();
                    }}
                  />
                )
              }
            />

            {actuaciones.error && (
              <ErrorEnPantalla error={actuaciones.error} alReintentar={actuaciones.recargar} />
            )}
            <ConEsqueleto
              recurso={actuaciones}
              clave={`actuaciones:${id}`}
              ejemplo={[]}
              etiqueta="Cargando las actuaciones…"
            >
              {(vistas) => (
                <Actuaciones
                  expedienteId={exp.expedienteId}
                  actuaciones={vistas}
                  estadoExpediente={exp.estado}
                  puedeAgregar={puedeGestionar}
                  alAgregar={() => {
                    actuaciones.recargar();
                    // El contador de la carátula cambia con cada actuación.
                    expediente.recargar();
                  }}
                />
              )}
            </ConEsqueleto>
          </>
        )}
      </ConEsqueleto>
    </>
  );
}
