package ar.edu.uade.ciudadanos.persona.state;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Clase base abstracta que centraliza la logica comun del patron State para Ciudadano.
 */
public abstract class AbstractCiudadanoState implements CiudadanoState {

    private final EstadoCiudadano estado;
    private final Set<EstadoCiudadano> transicionesPermitidas;

    protected AbstractCiudadanoState(EstadoCiudadano estado, Set<EstadoCiudadano> transicionesPermitidas) {
        this.estado = estado;
        this.transicionesPermitidas = Collections.unmodifiableSet(transicionesPermitidas);
    }

    @Override
    public EstadoCiudadano getEstado() {
        return estado;
    }

    @Override
    public Set<EstadoCiudadano> getTransicionesPermitidas() {
        return transicionesPermitidas;
    }

    @Override
    public boolean esTerminal() {
        return transicionesPermitidas.isEmpty();
    }

    @Override
    public CiudadanoState cambiarEstado(EstadoCiudadano nuevoEstado) {
        if (nuevoEstado == null) {
            throw ApiException.invalido("El nuevo estado no puede ser nulo");
        }
        if (this.estado == nuevoEstado) {
            throw ApiException.conflicto("El ciudadano ya esta en estado " + nuevoEstado);
        }
        if (!transicionesPermitidas.contains(nuevoEstado)) {
            String posibles = transicionesPermitidas.isEmpty()
                    ? "ninguno, " + estado + " es un estado final"
                    : transicionesPermitidas.stream()
                            .map(Enum::name)
                            .sorted()
                            .collect(Collectors.joining(", "));
            throw ApiException.conflicto(
                    "Transicion invalida de " + estado + " a " + nuevoEstado + ". Destinos permitidos: " + posibles);
        }
        return CiudadanoState.de(nuevoEstado);
    }
}
