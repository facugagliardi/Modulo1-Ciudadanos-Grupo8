package ar.edu.uade.ciudadanos.domicilio.dto;

import java.time.LocalDate;
import java.util.UUID;

/** 201 de POST /personas/{personaId}/domicilios. */
public record DomicilioCreadoResponse(
        Long propiedadId,
        Long personaId,
        String tipo,
        String calle,
        String numero,
        UUID idBarrio,
        LocalDate vigenteDesde,
        boolean esPrincipal) {
}
