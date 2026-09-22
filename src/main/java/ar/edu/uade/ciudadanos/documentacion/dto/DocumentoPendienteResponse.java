package ar.edu.uade.ciudadanos.documentacion.dto;

import ar.edu.uade.ciudadanos.documentacion.entity.Documento;
import java.time.OffsetDateTime;

/** Item devuelto en el panel de administrador para documentos pendientes. */
public record DocumentoPendienteResponse(
        Long documentoId,
        Long personaId,
        String tipoDocumento,
        Integer version,
        OffsetDateTime fechaCreacion) {

    public static DocumentoPendienteResponse de(Documento d) {
        return new DocumentoPendienteResponse(
                d.getDocumentoId(),
                d.getPersonaId(),
                d.getTipoDocumento(),
                d.getVersion(),
                d.getFechaCreacion()
        );
    }
}
