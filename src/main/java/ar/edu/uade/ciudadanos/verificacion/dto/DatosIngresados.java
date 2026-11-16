package ar.edu.uade.ciudadanos.verificacion.dto;

import java.time.LocalDate;

/** Lo que el usuario tipeo en el formulario de registro. */
public record DatosIngresados(
        String dni,
        String cuil,
        String nombre,
        String apellido,
        LocalDate fechaNacimiento,
        String nacionalidad) {
}
