package ar.edu.uade.ciudadanos.auth.dto;

/**
 * Resultado de un login: el cuerpo que ve el cliente mas los tokens, que el
 * controller vuelca a los headers.
 *
 * @param <T> tipo del cuerpo (LoginResponse o EmpleadoLoginResponse)
 */
public record Sesion<T>(T cuerpo, TokenEmitido tokens) {
}
