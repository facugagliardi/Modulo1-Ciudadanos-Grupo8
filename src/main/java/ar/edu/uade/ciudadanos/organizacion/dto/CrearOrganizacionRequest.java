package ar.edu.uade.ciudadanos.organizacion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * POST /organizaciones (RF-02, RF-19).
 *
 * <p>{@code tipo} y {@code taxId} no estan en la spec pero la tabla los exige:
 * {@code tipo} default OTRO, {@code taxId} default el CUIT sin guiones.
 */
public record CrearOrganizacionRequest(
        @NotBlank(message = "cuit es obligatorio")
        String cuit,

        @NotBlank(message = "razonSocial es obligatoria")
        @Size(max = 255, message = "razonSocial no puede superar los 255 caracteres")
        String razonSocial,

        @Size(max = 255, message = "nombreFantasia no puede superar los 255 caracteres")
        String nombreFantasia,

        String tipo,

        @Size(max = 255, message = "taxId no puede superar los 255 caracteres")
        String taxId,

        /** Duenos iniciales. Al menos uno: una organizacion sin titular no sirve. */
        @NotEmpty(message = "personaId debe traer al menos un dueno")
        List<Long> personaId) {
}
