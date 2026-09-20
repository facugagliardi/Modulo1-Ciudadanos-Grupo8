package ar.edu.uade.ciudadanos.mensajeria;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;

/** Datos de dominio que se convierten al TextMessage JMS. */
public record EnviarSolicitudDocumentacionRequest(
        @NotNull Long ciudadanoId,
        @NotBlank String solicitudId,
        @NotBlank String programaId,
        @NotNull @Future OffsetDateTime fechaLimite,
        @NotEmpty List<@Valid DocumentoRequeridoRequest> documentosRequeridos) {

    public record DocumentoRequeridoRequest(
            @NotBlank String tipo,
            @NotBlank String descripcion,
            boolean obligatorio) {
    }
}
