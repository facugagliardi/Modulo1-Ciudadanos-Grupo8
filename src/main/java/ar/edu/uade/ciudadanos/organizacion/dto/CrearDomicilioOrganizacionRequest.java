package ar.edu.uade.ciudadanos.organizacion.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * POST /organizaciones/{id}/domicilios.
 * Acepta propiedadId para vincular un inmueble existente,
 * o los campos para crear uno nuevo.
 */
public record CrearDomicilioOrganizacionRequest(
        @JsonAlias({"codigoPropiedad"})
        Long propiedadId,

        String tipo,

        @Size(max = 255, message = "calle no puede superar los 255 caracteres")
        String calle,

        @Size(max = 50, message = "numero no puede superar los 50 caracteres")
        String numero,

        @JsonAlias("altura")
        @Size(max = 50, message = "piso no puede superar los 50 caracteres")
        String piso,

        UUID idBarrio,

        @Size(max = 50, message = "longitud no puede superar los 50 caracteres")
        String longitud,

        @Size(max = 50, message = "latitud no puede superar los 50 caracteres")
        String latitud,

        Boolean esPrincipal) {

    public String altura() {
        return piso;
    }
}
