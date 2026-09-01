package ar.edu.uade.ciudadanos.documentacion.dto;

import ar.edu.uade.ciudadanos.documentacion.entity.EstadoSolicitud;
import ar.edu.uade.ciudadanos.documentacion.entity.OrigenSolicitud;
import ar.edu.uade.ciudadanos.documentacion.entity.SolicitudDocumentacion;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Solicitud de documentacion (RF-27, RF-28, RF-29). */
public record SolicitudResponse(
        Long solicitudId,
        Long titularId,
        String tipoDocumento,
        LocalDate plazo,
        EstadoSolicitud estado,
        OrigenSolicitud origen,
        Long documentoId,
        OffsetDateTime creadoEn) {

    public static SolicitudResponse de(SolicitudDocumentacion s) {
        return new SolicitudResponse(s.getSolicitudId(), s.getTitularId(), s.getTipoDocumento(), s.getPlazo(),
                s.getEstado(), s.getOrigen(), s.getDocumentoId(), s.getCreadoEn());
    }
}
