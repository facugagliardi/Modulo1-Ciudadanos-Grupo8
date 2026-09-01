package ar.edu.uade.ciudadanos.domicilio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** PUT /domicilios/{id}. Reemplaza los datos de la propiedad, no la vigencia. */
public record ActualizarDomicilioRequest(
        @NotBlank(message = "tipo es obligatorio")
        String tipo,

        @NotBlank(message = "calle es obligatoria")
        @Size(max = 255, message = "calle no puede superar los 255 caracteres")
        String calle,

        @NotBlank(message = "numero es obligatorio")
        @Size(max = 50, message = "numero no puede superar los 50 caracteres")
        String numero,

        @Size(max = 50, message = "altura no puede superar los 50 caracteres")
        String altura,

        UUID idBarrio,

        @Size(max = 50, message = "longitud no puede superar los 50 caracteres")
        String longitud,

        @Size(max = 50, message = "latitud no puede superar los 50 caracteres")
        String latitud) {
}
