package ar.edu.uade.ciudadanos.documentacion.dto;

import ar.edu.uade.ciudadanos.documentacion.entity.Documento;
import ar.edu.uade.ciudadanos.documentacion.entity.ResultadoValidacion;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** 200 de GET /documentos/{id}. */
public record DocumentoResponse(
        Long documentoId,
        Long personaId,
        String tipoDocumento,
        Integer version,
        LocalDate vigenciaHasta,
        String cargadoPor,
        String validadoPor,
        ResultadoValidacion resultadoValidacion,
        OffsetDateTime fechaValidacion,
        String urlArchivo,
        OffsetDateTime fechaCreacion) {

    public static DocumentoResponse de(Documento d) {
        return new DocumentoResponse(d.getDocumentoId(), d.getPersonaId(), d.getTipoDocumento(), d.getVersion(),
                d.getVigenciaHasta(), d.getCargadoPor(), d.getValidadoPor(), d.getResultadoValidacion(),
                d.getFechaValidacion(), d.getUrlArchivo(), d.getFechaCreacion());
    }
}
