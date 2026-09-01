package ar.edu.uade.ciudadanos.documentacion.dto;

import ar.edu.uade.ciudadanos.documentacion.entity.OrigenSolicitud;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** POST /solicitudes-documentacion (RF-27, RF-29). */
public record CrearSolicitudRequest(
        @NotNull(message = "titularId es obligatorio")
        Long titularId,

        /** Se valida contra la lista blanca de tipos de documento. */
        @NotBlank(message = "tipoDocumento es obligatorio")
        String tipoDocumento,

        @NotNull(message = "plazo es obligatorio")
        LocalDate plazo,

        /** INTERNA (default) o EVENTO, cuando la dispara otro modulo. */
        OrigenSolicitud origen) {
}
