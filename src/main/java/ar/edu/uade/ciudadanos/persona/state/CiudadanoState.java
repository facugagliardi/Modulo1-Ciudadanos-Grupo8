package ar.edu.uade.ciudadanos.persona.state;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.util.Set;

/**
 * Interfaz base del patron State (GoF) para el ciclo de vida de un Ciudadano.
 */
public interface CiudadanoState {

    EstadoCiudadano getEstado();

    Set<EstadoCiudadano> getTransicionesPermitidas();

    boolean esTerminal();

    CiudadanoState cambiarEstado(EstadoCiudadano nuevoEstado);

    static CiudadanoState de(EstadoCiudadano estado) {
        if (estado == null) {
            return new ActivoState();
        }
        return switch (estado) {
            case ACTIVO -> new ActivoState();
            case INACTIVO -> new InactivoState();
            case BLOQUEADO -> new BloqueadoState();
            case FALLECIDO -> new FallecidoState();
        };
    }
}
