package ar.edu.uade.ciudadanos.documentacion.dto;

import java.time.OffsetDateTime;

/** 201 de POST /personas/{personaId}/documentos y de POST /documentos/{id}/version. */
public record DocumentoCreadoResponse(
        Long documentoId,
        Long personaId,
        String tipoDocumento,
        Integer version,
        String cargadoPor,
        OffsetDateTime fechaCreacion) {
}
