package ar.edu.uade.ciudadanos.persona.state;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.util.Set;

/**
 * Estado terminal de un ciudadano. No admite transicion a ningun otro estado.
 */
public class FallecidoState extends AbstractCiudadanoState {

    public FallecidoState() {
        super(EstadoCiudadano.FALLECIDO, Set.of());
    }
}
