package ar.edu.uade.ciudadanos.persona.dto;

import jakarta.validation.constraints.NotNull;

/** PATCH /relaciones/{id}/responsable (RF-18). */
public record CambioResponsableRequest(
        @NotNull(message = "esResponsable es obligatorio")
        Boolean esResponsable) {
}
