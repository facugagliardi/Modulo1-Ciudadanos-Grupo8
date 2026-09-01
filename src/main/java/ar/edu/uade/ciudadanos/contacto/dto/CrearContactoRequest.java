package ar.edu.uade.ciudadanos.contacto.dto;

import ar.edu.uade.ciudadanos.contacto.entity.TipoContacto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** POST /ciudadanos/{ciudadanoId}/contactos (RF-13). */
public record CrearContactoRequest(
        @NotNull(message = "tipo es obligatorio (EMAIL o TELEFONO)")
        TipoContacto tipo,

        @NotBlank(message = "valor es obligatorio")
        @Size(max = 255, message = "valor no puede superar los 255 caracteres")
        String valor) {
}
