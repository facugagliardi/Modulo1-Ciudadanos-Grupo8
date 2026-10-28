package ar.edu.uade.ciudadanos.auth.dto;

/** Cuerpo de 200 en POST /auth/empleados/login. */
public record EmpleadoLoginResponse(Long empleadoId, String rol, java.util.UUID actorId) {
    public EmpleadoLoginResponse(Long empleadoId, String rol) {
        this(empleadoId, rol, null);
    }

    @com.fasterxml.jackson.annotation.JsonProperty("actorType")
    public String actorType() { return "EMPLEADO"; }
}
