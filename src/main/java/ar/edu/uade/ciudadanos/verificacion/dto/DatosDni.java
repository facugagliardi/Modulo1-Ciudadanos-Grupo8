package ar.edu.uade.ciudadanos.verificacion.dto;

import java.time.LocalDate;

/**
 * Lo que el modelo de vision leyo en las fotos del DNI. Cualquier campo puede
 * venir en null si no se leyo con claridad: el modelo tiene prohibido adivinar.
 */
public record DatosDni(
        boolean esDniArgentino,
        boolean frenteLegible,
        boolean dorsoLegible,
        String apellido,
        String nombre,
        /** Solo digitos, sin puntos. */
        String numeroDocumento,
        String sexo,
        String nacionalidad,
        LocalDate fechaNacimiento,
        LocalDate fechaVencimiento,
        /** Los 11 digitos, sin guiones. Esta en el dorso. */
        String cuil,
        String observaciones) {
}
