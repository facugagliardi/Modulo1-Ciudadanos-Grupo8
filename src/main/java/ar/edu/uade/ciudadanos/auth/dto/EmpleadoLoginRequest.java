package ar.edu.uade.ciudadanos.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** POST /auth/empleados/login. */
public record EmpleadoLoginRequest(
        @NotBlank(message = "mail es obligatorio")
        @Email(message = "mail con formato invalido")
        String mail,

        @NotBlank(message = "password es obligatorio")
        String password) {
}
