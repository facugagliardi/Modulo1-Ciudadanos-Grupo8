package ar.edu.uade.ciudadanos.organizacion.dto;

import java.time.LocalDate;

/**
 * GET /representaciones/vigencia (RF-22, consulta inter-modulo).
 * Nunca 404: si no hay poder vigente responde {@code vigente:false}.
 */
public record VigenciaRepresentacionResponse(
        boolean vigente, Long representacionId, String alcance, LocalDate hasta) {

    public static VigenciaRepresentacionResponse noVigente() {
        return new VigenciaRepresentacionResponse(false, null, null, null);
    }
}
