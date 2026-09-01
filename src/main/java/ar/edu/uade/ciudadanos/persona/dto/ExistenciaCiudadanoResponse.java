package ar.edu.uade.ciudadanos.persona.dto;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;

/**
 * GET /ciudadanos/dni/{dni} y GET /ciudadanos/existe (RF-06).
 * Nunca da 404: responde 200 con {@code existe:false}.
 */
public record ExistenciaCiudadanoResponse(
        boolean existe, Long id, String nombre, String apellido, EstadoCiudadano estado) {

    public static ExistenciaCiudadanoResponse noExiste() {
        return new ExistenciaCiudadanoResponse(false, null, null, null, null);
    }
}
