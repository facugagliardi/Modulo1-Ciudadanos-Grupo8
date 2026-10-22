package ar.edu.uade.ciudadanos.auth.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

public record UsuarioLoginRequest(
        @NotBlank(message = "gmail es obligatorio")
        @JsonAlias({"email", "mail", "username"})
        String gmail,

        @NotBlank(message = "password es obligatoria")
        String password
) {
}
