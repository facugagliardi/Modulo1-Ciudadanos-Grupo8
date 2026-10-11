package ar.edu.uade.ciudadanos.documentacion.dto;

import java.time.OffsetDateTime;

/** 201 de POST /ciudadanos/{ciudadanoId}/documentos y de POST /documentos/{id}/version. */
public record DocumentoCreadoResponse(
        Long documentoId,
        Long ciudadanoId,
        String tipoDocumento,
        Integer version,
        String cargadoPor,
        OffsetDateTime fechaCreacion) {
}
