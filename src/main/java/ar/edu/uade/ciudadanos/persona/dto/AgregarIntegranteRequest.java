package ar.edu.uade.ciudadanos.persona.dto;

import jakarta.validation.constraints.NotNull;

public record AgregarIntegranteRequest(
        @NotNull(message = "El ciudadanoId es obligatorio")
        Long ciudadanoId) {
}
