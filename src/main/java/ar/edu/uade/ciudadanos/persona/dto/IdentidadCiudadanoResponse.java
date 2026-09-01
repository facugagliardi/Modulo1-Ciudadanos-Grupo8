package ar.edu.uade.ciudadanos.persona.dto;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;

/** GET /ciudadanos/{id}/identidad (consulta inter-modulo). */
public record IdentidadCiudadanoResponse(
        Long id, String dni, String nombre, String apellido, EstadoCiudadano estado) {
}
