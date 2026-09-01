package ar.edu.uade.ciudadanos.organizacion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** POST /representaciones (RF-20). */
public record CrearRepresentacionRequest(
        @NotNull(message = "personaId es obligatorio")
        Long personaId,

        @NotNull(message = "organizacionId es obligatorio")
        Long organizacionId,

        /** Se valida contra lista blanca: TOTAL, TRAMITES, FIRMA o CONSULTA. */
        @NotBlank(message = "alcance es obligatorio")
        String alcance,

        @NotNull(message = "desde es obligatoria")
        LocalDate desde,

        /** null = sin vencimiento. */
        LocalDate hasta) {
}
