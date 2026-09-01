package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import java.time.LocalDate;

/** Item de GET /organizaciones/{id}/representaciones: quien representa. */
public record RepresentacionDeOrganizacionResponse(
        Long representacionId,
        Long personaId,
        String nombre,
        String apellido,
        String alcance,
        LocalDate desde,
        LocalDate hasta,
        EstadoRepresentacion estado) {
}
