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
import { Cargando, ErrorEnPantalla } from "@/componentes/Estados";
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
export function DetalleExpediente({ zona = "portal" }) {
  const { id } = useParams();
  const puedeGestionar = usePermiso(PERMISOS.GESTIONAR_EXPEDIENTES);
  const puedeCambiarEstado = usePermiso(PERMISOS.CAMBIAR_ESTADO_EXPEDIENTE);
  const puedeLeerTerceros = usePermiso(PERMISOS.LEER_TERCEROS);

  const expediente = useRecurso(useCallback((s) => obtenerExpediente(id, s), [id]));
  const actuaciones = useRecurso(useCallback((s) => listarActuaciones(id, s), [id]));

  const personaId = expediente.datos?.personaId;
  // El titular puede ser una persona jurídica, y para esas no hay endpoint de
  // consulta: si falla, se muestra el número de persona y listo.
  const titular = useRecurso(
    useCallback(
      (s) => (personaId ? obtenerCiudadano(personaId, s).catch(() => null) : Promise.resolve(null)),
      [personaId],
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

      {expediente.cargando && <Cargando texto="Buscando el expediente…" />}
      {expediente.error && (
        <ErrorEnPantalla error={expediente.error} alReintentar={expediente.recargar} />
      )}

      {expediente.datos && (
        <>
          <Caratula
            expediente={expediente.datos}
            titular={titular.datos}
            enlaceTitular={
              zona === "admin" && puedeLeerTerceros ? `/admin/padron/${personaId}` : null
            }
            acciones={
              puedeCambiarEstado && (
                <CambiarEstado
                  entidad={ENTIDADES.EXPEDIENTE}
                  estadoActual={expediente.datos.estado}
                  nombreEntidad="este expediente"
                  // Regla del alcance que el backend todavía no valida: un
                  // expediente no debería resolverse sin ninguna actuación.
                  destinosBloqueados={
                    lista.length === 0
                      ? { RESUELTO: "Necesita al menos una actuación" }
                      : {}
                  }
                  alConfirmar={async (nuevo) => {
                    await cambiarEstadoExpediente(expediente.datos.expedienteId, nuevo);
                    expediente.recargar();
                  }}
                />
              )
            }
          />

          {actuaciones.error ? (
            <ErrorEnPantalla error={actuaciones.error} alReintentar={actuaciones.recargar} />
          ) : actuaciones.cargando ? (
            <Cargando />
          ) : (
            <Actuaciones
              expedienteId={expediente.datos.expedienteId}
              actuaciones={lista}
              estadoExpediente={expediente.datos.estado}
              puedeAgregar={puedeGestionar}
              alAgregar={() => {
                actuaciones.recargar();
                // El contador de la carátula cambia con cada actuación.
                expediente.recargar();
              }}
            />
          )}
        </>
      )}
    </>
  );
}
