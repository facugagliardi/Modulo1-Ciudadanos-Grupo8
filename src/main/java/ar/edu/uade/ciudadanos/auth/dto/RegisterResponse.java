package ar.edu.uade.ciudadanos.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Cuerpo de 201 en POST /auth/register.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RegisterResponse(
        Long ciudadanoId,
        String dni,
        String nombre,
        String apellido,
        LocalDate fechaNacimiento,
        String cuil,
        String estado,
        OffsetDateTime creadoEn) {

    public static RegisterResponse fisica(Long ciudadanoId, String dni, String nombre, String apellido,
                                          LocalDate fechaNacimiento, String cuil, String estado,
                                          OffsetDateTime creadoEn) {
        return new RegisterResponse(ciudadanoId, dni, nombre, apellido, fechaNacimiento,
                cuil, estado, creadoEn);
    }
}
