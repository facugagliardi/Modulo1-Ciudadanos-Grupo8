package ar.edu.uade.ciudadanos.persona.dto;

/**
 * Item de GET /ciudadanos/{id}/relaciones: la relacion vista desde ese
 * ciudadano, con el otro extremo ya resuelto.
 */
public record RelacionDeCiudadanoResponse(
        Long relacionId,
        Long ciudadanoRelacionadoId,
        String nombre,
        String apellido,
        /** Que es el otro ciudadano para el consultado. */
        String tipoRelacion,
        boolean esResponsable) {
}
