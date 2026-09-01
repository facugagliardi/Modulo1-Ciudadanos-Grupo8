package ar.edu.uade.ciudadanos.organizacion.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** 201 de POST /organizaciones/{id}/duenos. */
public record DuenoAgregadoResponse(
        Long organizacionId,
        Long personaId,
        String dni,
        BigDecimal porcentajeTitularidad,
        OffsetDateTime asociadoEn) {
}
