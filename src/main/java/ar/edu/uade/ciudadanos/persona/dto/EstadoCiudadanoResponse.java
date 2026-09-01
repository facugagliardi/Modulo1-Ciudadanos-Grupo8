package ar.edu.uade.ciudadanos.persona.dto;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;

/** GET /ciudadanos/{id}/estado (consulta inter-modulo). */
public record EstadoCiudadanoResponse(Long id, EstadoCiudadano estado) {
}
