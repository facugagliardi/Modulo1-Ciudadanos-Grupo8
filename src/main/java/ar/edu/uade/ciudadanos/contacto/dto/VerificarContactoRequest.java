package ar.edu.uade.ciudadanos.contacto.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** PATCH /contactos/{id}/verificar (RF-14). */
public record VerificarContactoRequest(
        @NotBlank(message = "codigo es obligatorio")
        @Pattern(regexp = "^[0-9]{6}$", message = "codigo debe ser de 6 digitos")
        String codigo) {
}
