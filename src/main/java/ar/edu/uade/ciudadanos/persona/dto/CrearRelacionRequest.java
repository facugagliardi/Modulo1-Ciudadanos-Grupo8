package ar.edu.uade.ciudadanos.persona.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** POST /relaciones (RF-16, RF-17, RF-18). */
public record CrearRelacionRequest(
        @NotNull(message = "ciudadanoId1 es obligatorio")
        Long ciudadanoId1,

        @NotNull(message = "ciudadanoId2 es obligatorio")
        Long ciudadanoId2,

        /** Rol del ciudadano 1 respecto del 2. Se valida contra lista blanca. */
        @NotBlank(message = "relacionCiudadano1 es obligatorio")
        String relacionCiudadano1,

        /** Rol del ciudadano 2 respecto del 1. */
        @NotBlank(message = "relacionCiudadano2 es obligatorio")
        String relacionCiudadano2,

        Boolean esResponsable) {
}
