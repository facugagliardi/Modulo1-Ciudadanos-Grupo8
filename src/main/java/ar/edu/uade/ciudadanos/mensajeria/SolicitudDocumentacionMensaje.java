package ar.edu.uade.ciudadanos.mensajeria;

import java.time.OffsetDateTime;
import java.util.List;

/** Payload del evento que el laboratorio envia a la cola de trabajo. */
public record SolicitudDocumentacionMensaje(
        String mensajeId,
        Long ciudadanoId,
        String solicitudId,
        String programaId,
        OffsetDateTime fechaLimite,
        List<DocumentoRequerido> documentosRequeridos) {

    public record DocumentoRequerido(String tipo, String descripcion, boolean obligatorio) {
    }
}
