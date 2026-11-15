package ar.edu.uade.ciudadanos.verificacion.dto;

import java.util.List;

/**
 * Respuesta de POST /auth/verificar-dni. {@code coincide} es true solo si las
 * fotos son de un DNI argentino legible, vigente, y todos los campos coinciden.
 */
public record ResultadoVerificacionDni(
        boolean coincide,
        List<CampoVerificado> campos,
        /** Problemas generales (no es un DNI, foto ilegible, vencido...). */
        List<String> problemas,
        DatosDni leido) {
}
