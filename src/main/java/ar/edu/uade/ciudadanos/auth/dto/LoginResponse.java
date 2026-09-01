package ar.edu.uade.ciudadanos.auth.dto;

/** Cuerpo de 200 en POST /auth/login. El token va en los headers. */
public record LoginResponse(Long personaId, String tipoPersona, String rol) {
}
