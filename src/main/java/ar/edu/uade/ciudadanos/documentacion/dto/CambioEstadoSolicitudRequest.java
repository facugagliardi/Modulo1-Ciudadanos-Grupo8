package ar.edu.uade.ciudadanos.documentacion.dto;

import ar.edu.uade.ciudadanos.documentacion.entity.EstadoSolicitud;
import jakarta.validation.constraints.NotNull;

/**
 * PATCH /solicitudes-documentacion/{id}/estado (RF-28).
 *
 * <p>Pasar a CUMPLIDA exige {@code documentoId}: es la restriccion
 * ck_solicitud_cumplida de la base, validada antes para dar un 400 con motivo.
 */
public record CambioEstadoSolicitudRequest(
        @NotNull(message = "estado es obligatorio (PENDIENTE, CUMPLIDA o VENCIDA)")
        EstadoSolicitud estado,

        Long documentoId) {
}
