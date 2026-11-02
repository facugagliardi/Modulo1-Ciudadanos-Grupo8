package ar.edu.uade.ciudadanos.organizacion.dto;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

/**
 * PUT /organizaciones/{id}. Lista blanca de lo modificable: el CUIT y el taxId
 * identifican a la organizacion y no se cambian por aca; el estado va por
 * PATCH /organizaciones/{id}/estado.
 */
public record ActualizarOrganizacionRequest(
        @Size(max = 255, message = "razonSocial no puede superar los 255 caracteres")
        @Pattern(regexp = "(?s).*\\S.*", message = "razonSocial no puede estar en blanco")
        String razonSocial,

        @Size(max = 255, message = "nombreFantasia no puede superar los 255 caracteres")
        String nombreFantasia,

        String tipo) {
}
