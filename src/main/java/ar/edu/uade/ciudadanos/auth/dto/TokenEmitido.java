package ar.edu.uade.ciudadanos.auth.dto;

/** Par de tokens recien emitido, para volcarlo a los headers de respuesta. */
public record TokenEmitido(String accessToken, String refreshToken, long expiresInSeconds) {
}
