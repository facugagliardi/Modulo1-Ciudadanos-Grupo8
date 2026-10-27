package ar.edu.uade.ciudadanos.auth.dto;

import java.util.UUID;

/** Cuerpo de 200 en POST /auth/login. El token va en los headers. */
public record LoginResponse(Long personaId, String tipoPersona, String rol, UUID uuid) {
    public LoginResponse(Long personaId, String tipoPersona, String rol) {
        this(personaId, tipoPersona, rol, null);
    }
}
