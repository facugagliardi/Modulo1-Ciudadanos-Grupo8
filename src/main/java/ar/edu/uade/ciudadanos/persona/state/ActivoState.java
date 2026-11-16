package ar.edu.uade.ciudadanos.persona.state;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.util.Set;

/**
 * Estado activo/operativo de un ciudadano.
 * Permite pasar a INACTIVO, BLOQUEADO o FALLECIDO.
 */
public class ActivoState extends AbstractCiudadanoState {

    public ActivoState() {
        super(EstadoCiudadano.ACTIVO, Set.of(
                EstadoCiudadano.INACTIVO,
                EstadoCiudadano.BLOQUEADO,
                EstadoCiudadano.FALLECIDO
        ));
    }
}
