package ar.edu.uade.ciudadanos.domicilio.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * POST /personas/{personaId}/domicilios (RF-09).
 *
 * <p>{@code piso} y {@code esPrincipal} no estan en la spec pero si en el
 * modelo; van opcionales. Si la persona todavia no tiene principal vigente,
 * este pasa a serlo aunque no se pida.
 */
public record CrearDomicilioRequest(
        @NotBlank(message = "tipo es obligatorio")
        String tipo,

        @NotBlank(message = "calle es obligatoria")
        @Size(max = 255, message = "calle no puede superar los 255 caracteres")
        String calle,

        @NotBlank(message = "numero es obligatorio")
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
