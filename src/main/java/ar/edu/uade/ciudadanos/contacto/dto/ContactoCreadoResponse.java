package ar.edu.uade.ciudadanos.contacto.dto;

import ar.edu.uade.ciudadanos.contacto.entity.TipoContacto;
import java.time.OffsetDateTime;

/** 201 de POST /ciudadanos/{ciudadanoId}/contactos. */
public record ContactoCreadoResponse(
        Long contactoId,
        Long ciudadanoId,
        TipoContacto tipo,
        String valor,
        boolean verificado,
        OffsetDateTime creadoEn) {
}
