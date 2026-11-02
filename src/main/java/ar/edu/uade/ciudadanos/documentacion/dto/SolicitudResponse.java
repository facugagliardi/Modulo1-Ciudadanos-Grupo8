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
        OffsetDateTime creadoEn,
        String nombreDocumento, String descripcionDocumento, Boolean obligatorio) {

    public static SolicitudResponse de(SolicitudDocumentacion s) {
        com.fasterxml.jackson.databind.JsonNode requisito = null;
        if (s.getContextoSocial() != null) {
            try { requisito = new com.fasterxml.jackson.databind.ObjectMapper().readTree(s.getContextoSocial()).path("requirement"); }
            catch (java.io.IOException e) { throw new IllegalStateException("Contexto social invalido", e); }
        }
        return new SolicitudResponse(s.getSolicitudId(), s.getTitularId(), s.getTipoDocumento(), s.getPlazo(),
                s.getEstado(), s.getOrigen(), s.getDocumentoId(), s.getCreadoEn(),
                requisito == null ? null : requisito.path("name").asText(requisito.path("type").asText()),
                requisito == null ? null : requisito.path("description").asText(null),
                requisito == null ? null : requisito.path("required").booleanValue());
    }
}
