package ar.edu.uade.ciudadanos.expediente.dto;

import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import jakarta.validation.constraints.NotNull;

/**
 * PATCH /expedientes/{id}/estado (RF-32).
 * Endpoint INFERIDO: el RF existe pero la spec v2 no documenta la ruta.
 */
public record CambioEstadoExpedienteRequest(
        @NotNull(message = "estado es obligatorio (INICIADO, EN_TRAMITE, RESUELTO o ARCHIVADO)")
        EstadoExpediente estado) {
}
