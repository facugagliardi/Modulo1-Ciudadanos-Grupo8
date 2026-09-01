package ar.edu.uade.ciudadanos.persona.dto;

import java.time.OffsetDateTime;

/** Respuesta comun de todos los PATCH .../estado. */
public record CambioEstadoResponse(
        Long id, String estadoAnterior, String estadoNuevo, OffsetDateTime actualizadoEn) {

    public static CambioEstadoResponse de(Long id, Enum<?> anterior, Enum<?> nuevo) {
        return new CambioEstadoResponse(id, anterior.name(), nuevo.name(), OffsetDateTime.now());
    }
}
