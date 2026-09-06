package ar.edu.uade.ciudadanos.persona.dto;

public record IntegranteResponse(
        Long ciudadanoId,
        String dni,
        String nombre,
        String apellido) {
}
