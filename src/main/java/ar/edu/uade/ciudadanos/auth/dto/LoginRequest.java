package ar.edu.uade.ciudadanos.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * POST /auth/login. {@code cuit} acepta CUIT o CUIL, con o sin guiones.
 */
public record LoginRequest(
        @NotBlank(message = "cuit/cuil es obligatorio")
        String cuit,

        @NotBlank(message = "password es obligatorio")
        String password) {
}
