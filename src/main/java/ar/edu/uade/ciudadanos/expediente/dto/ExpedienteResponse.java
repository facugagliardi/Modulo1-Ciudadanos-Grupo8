package ar.edu.uade.ciudadanos.expediente.dto;

import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import java.time.OffsetDateTime;

/** 200 de GET /expedientes/{id} y items de GET /expedientes. */
public record ExpedienteResponse(
        Long expedienteId,
        String numero,
        Long personaId,
        String caratula,
        String areaIniciadora,
        EstadoExpediente estado,
        OffsetDateTime fechaInicio,
        long actuacionesCount) {
}
