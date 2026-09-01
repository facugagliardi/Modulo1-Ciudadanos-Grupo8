package ar.edu.uade.ciudadanos.persona.dto;

import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.time.LocalDate;

/** Item de GET /ciudadanos: sin domicilios ni contactos, para no hacer N+1. */
public record CiudadanoResumenResponse(
        Long id,
        String dni,
        String nombre,
        String apellido,
        LocalDate fechaNacimiento,
        String cuil,
        EstadoCiudadano estado) {

    public static CiudadanoResumenResponse de(Ciudadano c, Long cuil) {
        return new CiudadanoResumenResponse(c.getId(), c.getDocumentoId(), c.getNombre(), c.getApellido(),
                c.getFechaNacimiento(), cuil == null ? null : String.valueOf(cuil), c.getEstado());
    }
}
