package ar.edu.uade.ciudadanos.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /auth/refresh. */
public record RefreshRequest(
        @NotBlank(message = "refreshToken es obligatorio")
        String refreshToken) {
}
