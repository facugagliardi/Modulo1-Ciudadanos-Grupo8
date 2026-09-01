package ar.edu.uade.ciudadanos.auth.dto;

import ar.edu.uade.ciudadanos.persona.entity.TipoPersona;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * POST /auth/register (RF-01, RF-02, RF-37). Un solo payload para los dos tipos
 * de persona: {@code tipo} decide que bloque de campos se exige, y esa
 * validacion cruzada la hace AuthService (no se puede expresar con anotaciones).
 * El domicilio se carga despues, con POST /personas/{id}/domicilios.
 */
public record RegisterRequest(
        @NotNull(message = "tipo es obligatorio (CIUDADANO o JURIDICA)")
        TipoPersona tipo,

        /** CUIT/CUIL de 11 digitos, con o sin guiones. */
        @NotBlank(message = "cuit/cuil es obligatorio")
        String cuit,

        @NotBlank(message = "password es obligatorio")
        @Size(min = 8, message = "password debe tener al menos 8 caracteres")
        String password,

        // --- Solo CIUDADANO ---
        @Pattern(regexp = "^$|^[0-9]{7,9}$", message = "dni debe tener entre 7 y 9 digitos")
        String dni,
        String nombre,
        String apellido,
        LocalDate fechaNacimiento,

        // --- Solo JURIDICA ---
        String razonSocial,
        String nombreFantasia,
        LocalDate fechaDeCreacion) {
}
