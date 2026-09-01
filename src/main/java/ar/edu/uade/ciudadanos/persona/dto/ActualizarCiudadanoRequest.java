package ar.edu.uade.ciudadanos.persona.dto;

import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * PUT /ciudadanos/{id} (RF-04).
 *
 * <p>Lista blanca de lo modificable: cualquier otro campo del cuerpo hace
 * fallar el request con 400. El estado NO esta aca a proposito: se cambia por
 * PATCH /ciudadanos/{id}/estado, que valida las transiciones.
 *
 * <p>Un campo en null significa "no lo toques".
 */
public record ActualizarCiudadanoRequest(
        @Size(max = 255, message = "nombre no puede superar los 255 caracteres")
        String nombre,

        @Size(max = 255, message = "apellido no puede superar los 255 caracteres")
        String apellido,

        @Past(message = "fechaNacimiento debe ser anterior a hoy")
        LocalDate fechaNacimiento,

        @Pattern(regexp = "^[0-9]{7,9}$", message = "dni debe tener entre 7 y 9 digitos")
        String dni,

        @Pattern(regexp = "^[0-9-]{11,13}$", message = "cuil debe tener 11 digitos")
        String cuil) {
}
