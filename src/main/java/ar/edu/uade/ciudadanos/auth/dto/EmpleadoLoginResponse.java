package ar.edu.uade.ciudadanos.auth.dto;

/** Cuerpo de 200 en POST /auth/empleados/login. */
public record EmpleadoLoginResponse(Long empleadoId, String rol) {
}
