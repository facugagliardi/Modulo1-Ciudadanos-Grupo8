package ar.edu.uade.ciudadanos.expediente.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** Item de GET /expedientes/{id}/actuaciones (RF-35). */
public record ActuacionResponse(
        Long expedienteId,
        Long actuacionId,
        String tipo,
        String descripcion,
        String moduloOrigen,
        OffsetDateTime fecha,
        List<String> adjuntos) {
}
