package ar.edu.uade.ciudadanos.persona.dto;

import java.time.LocalDate;
import java.util.List;

public record PersonaJuridicaResponse(
        Long id,
        String cuit,
        String razonSocial,
        String nombreFantasia,
        String estado,
        LocalDate fechaCreacion,
        List<IntegranteResponse> integrantes) {
}
