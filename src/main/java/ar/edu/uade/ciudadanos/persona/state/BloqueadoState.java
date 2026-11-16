package ar.edu.uade.ciudadanos.persona.state;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.util.Set;

/**
 * Estado bloqueado administrativamente.
 * Permite transicion a ACTIVO, INACTIVO o FALLECIDO.
 */
public class BloqueadoState extends AbstractCiudadanoState {

    public BloqueadoState() {
        super(EstadoCiudadano.BLOQUEADO, Set.of(
                EstadoCiudadano.ACTIVO,
                EstadoCiudadano.INACTIVO,
                EstadoCiudadano.FALLECIDO
        ));
    }
}
