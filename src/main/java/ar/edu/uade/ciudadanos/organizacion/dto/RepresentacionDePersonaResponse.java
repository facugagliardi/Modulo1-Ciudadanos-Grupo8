package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import java.time.LocalDate;

/** Item de GET /personas/{id}/representaciones: a quien representa. */
public record RepresentacionDePersonaResponse(
        Long representacionId,
        Long organizacionId,
        String razonSocial,
        String alcance,
        LocalDate desde,
        LocalDate hasta,
        EstadoRepresentacion estado) {
}
