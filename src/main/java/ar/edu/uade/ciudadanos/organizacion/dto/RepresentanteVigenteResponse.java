package ar.edu.uade.ciudadanos.organizacion.dto;

import java.time.LocalDate;

/** Representante con poder vigente, embebido en GET /organizaciones/{id}. */
public record RepresentanteVigenteResponse(
        Long personaId, String nombre, String apellido, String alcance, LocalDate desde, LocalDate hasta) {
}
