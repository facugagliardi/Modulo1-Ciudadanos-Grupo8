package ar.edu.uade.ciudadanos.organizacion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * POST /organizaciones (RF-02, RF-19).
 * El creador logueado se asume como el dueno inicial.
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
        String taxId) {
}
