package ar.edu.uade.ciudadanos.documentacion.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * PATCH /documentos/{id}/validar (RF-25, RF-26).
 *
 * <p>{@code vigenciaHasta} cubre el RF-25, que la spec agrupa en este endpoint:
 * al aprobar se puede fijar hasta cuando vale el documento.
 */
public record ValidarDocumentoRequest(
        @NotNull(message = "aprobado es obligatorio (true o false)")
        Boolean aprobado,

        LocalDate vigenciaHasta) {
}
