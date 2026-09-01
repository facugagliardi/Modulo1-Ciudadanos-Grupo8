package ar.edu.uade.ciudadanos.expediente.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * POST /expedientes (RF-30, RF-31).
 *
 * <p>Endpoint INFERIDO: la spec v2 no lo documenta y lo marca "a confirmar con
 * el equipo". El shape sigue al del GET.
 *
 * <p>{@code numero} es opcional: si no viene se genera EXP-{anio}-{secuencia}.
 */
public record CrearExpedienteRequest(
        @Size(max = 100, message = "numero no puede superar los 100 caracteres")
        String numero,

        @NotNull(message = "personaId es obligatorio")
        Long personaId,

        @NotBlank(message = "caratula es obligatoria")
        @Size(max = 255, message = "caratula no puede superar los 255 caracteres")
        String caratula,

        @NotBlank(message = "areaIniciadora es obligatoria")
        @Size(max = 255, message = "areaIniciadora no puede superar los 255 caracteres")
        String areaIniciadora) {
}
