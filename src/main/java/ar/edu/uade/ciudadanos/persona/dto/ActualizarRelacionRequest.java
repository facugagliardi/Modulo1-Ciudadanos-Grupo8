package ar.edu.uade.ciudadanos.persona.dto;

import jakarta.validation.constraints.NotBlank;

/** PUT /relaciones/{id} (RF-17): solo cambia el tipo por cada extremo. */
public record ActualizarRelacionRequest(
        @NotBlank(message = "relacionCiudadano1 es obligatorio")
        String relacionCiudadano1,

        @NotBlank(message = "relacionCiudadano2 es obligatorio")
        String relacionCiudadano2) {
}
