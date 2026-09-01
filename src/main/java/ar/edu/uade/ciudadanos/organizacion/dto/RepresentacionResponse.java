package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Representacion;
import java.time.LocalDate;

/** 201 de POST /representaciones. */
public record RepresentacionResponse(
        Long representacionId,
        Long personaId,
        Long organizacionId,
        String alcance,
        LocalDate desde,
        LocalDate hasta,
        EstadoRepresentacion estado) {

    public static RepresentacionResponse de(Representacion r) {
        return new RepresentacionResponse(r.getRepresentacionId(), r.getPersonaId(), r.getOrganizacionId(),
                r.getAlcance(), r.getDesde(), r.getHasta(), r.getEstado());
    }
}
