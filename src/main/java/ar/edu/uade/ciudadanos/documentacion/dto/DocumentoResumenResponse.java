package ar.edu.uade.ciudadanos.documentacion.dto;

import ar.edu.uade.ciudadanos.documentacion.entity.Documento;
import ar.edu.uade.ciudadanos.documentacion.entity.ResultadoValidacion;
import java.time.LocalDate;

/** Item de GET /personas/{personaId}/documentos. */
public record DocumentoResumenResponse(
        Long documentoId,
        String tipoDocumento,
        Integer version,
        LocalDate vigenciaHasta,
        String validadoPor,
        ResultadoValidacion resultadoValidacion) {

    public static DocumentoResumenResponse de(Documento d) {
        return new DocumentoResumenResponse(d.getDocumentoId(), d.getTipoDocumento(), d.getVersion(),
                d.getVigenciaHasta(), d.getValidadoPor(), d.getResultadoValidacion());
    }
}
