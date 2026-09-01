package ar.edu.uade.ciudadanos.documentacion.dto;

import ar.edu.uade.ciudadanos.documentacion.entity.ResultadoValidacion;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** 200 de PATCH /documentos/{id}/validar. */
public record DocumentoValidadoResponse(
        Long documentoId,
        String validadoPor,
        ResultadoValidacion resultado,
        LocalDate vigenciaHasta,
        OffsetDateTime fechaValidacion) {
}
