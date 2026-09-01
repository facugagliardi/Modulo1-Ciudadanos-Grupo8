package ar.edu.uade.ciudadanos.contacto.dto;

import java.time.OffsetDateTime;

/** 200 de PATCH /contactos/{id}/verificar. */
public record ContactoVerificadoResponse(Long contactoId, boolean verificado, OffsetDateTime verificadoEn) {
}
