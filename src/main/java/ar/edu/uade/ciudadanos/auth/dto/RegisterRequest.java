package ar.edu.uade.ciudadanos.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * POST /auth/register (RF-01, RF-37). Registro de ciudadanos.
 * El domicilio se carga despues, con POST /ciudadanos/{id}/domicilios.
 */
public record RegisterRequest(

        /** CUIL de 11 digitos, con o sin guiones. */
        @NotBlank(message = "cuit/cuil es obligatorio")
        String cuit,

        @NotBlank(message = "password es obligatorio")
        @Size(min = 8, message = "password debe tener al menos 8 caracteres")
        String password,

        @Pattern(regexp = "^$|^[0-9]{7,9}$", message = "dni debe tener entre 7 y 9 digitos")
        String dni,

        @NotBlank(message = "nombre es obligatorio")
        String nombre,

        @NotBlank(message = "apellido es obligatorio")
        String apellido,

        @NotNull(message = "fechaNacimiento es obligatorio")
        LocalDate fechaNacimiento) {
}
