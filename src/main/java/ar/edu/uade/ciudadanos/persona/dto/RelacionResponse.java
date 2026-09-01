package ar.edu.uade.ciudadanos.persona.dto;

import ar.edu.uade.ciudadanos.persona.entity.Relacion;
import java.time.OffsetDateTime;

/** 201 de POST /relaciones y 200 de PUT /relaciones/{id}. */
public record RelacionResponse(
        Long relacionId,
        Long ciudadanoId1,
        Long ciudadanoId2,
        String relacionCiudadano1,
        String relacionCiudadano2,
        boolean esResponsable,
        OffsetDateTime creadoEn) {

    public static RelacionResponse de(Relacion r) {
        return new RelacionResponse(r.getRelacionId(), r.getCiudadanoId1(), r.getCiudadanoId2(),
                r.getRelacionCiudadano1(), r.getRelacionCiudadano2(), r.isEsResponsable(), r.getCreadoEn());
    }
}
