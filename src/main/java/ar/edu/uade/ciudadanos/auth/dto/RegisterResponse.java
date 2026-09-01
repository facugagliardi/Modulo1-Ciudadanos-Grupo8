package ar.edu.uade.ciudadanos.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Cuerpo de 201 en POST /auth/register. Los campos que no aplican al tipo de
 * persona se omiten del JSON, de modo que fisica devuelve {@code cuil} y
 * juridica {@code cuit}, como pide la spec.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RegisterResponse(
        Long personaId,
        String tipo,
        String dni,
        String nombre,
        String apellido,
        LocalDate fechaNacimiento,
        String cuil,
        String cuit,
        String razonSocial,
        String nombreFantasia,
        String estado,
        OffsetDateTime creadoEn) {

    public static RegisterResponse fisica(Long personaId, String dni, String nombre, String apellido,
                                          LocalDate fechaNacimiento, String cuil, String estado,
                                          OffsetDateTime creadoEn) {
        return new RegisterResponse(personaId, "CIUDADANO", dni, nombre, apellido, fechaNacimiento,
                cuil, null, null, null, estado, creadoEn);
    }

    public static RegisterResponse juridica(Long personaId, String cuit, String razonSocial,
                                            String nombreFantasia, String estado, OffsetDateTime creadoEn) {
        return new RegisterResponse(personaId, "JURIDICA", null, null, null, null,
                null, cuit, razonSocial, nombreFantasia, estado, creadoEn);
    }
}
