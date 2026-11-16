package ar.edu.uade.ciudadanos.persona.state;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.util.Set;

/**
 * Estado inactivo de un ciudadano.
 * Permite reactivacion (ACTIVO) o transicion a BLOQUEADO o FALLECIDO.
 */
public class InactivoState extends AbstractCiudadanoState {

    public InactivoState() {
        super(EstadoCiudadano.INACTIVO, Set.of(
                EstadoCiudadano.ACTIVO,
                EstadoCiudadano.BLOQUEADO,
                EstadoCiudadano.FALLECIDO
        ));
    }
}
