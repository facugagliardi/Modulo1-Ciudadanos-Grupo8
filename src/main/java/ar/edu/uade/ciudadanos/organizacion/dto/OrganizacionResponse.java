package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioResponse;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import java.time.OffsetDateTime;
import java.util.List;

/** 200 de GET /organizaciones/{id} y 201 de POST /organizaciones. */
public record OrganizacionResponse(
        Long organizacionId,
        String cuit,
        String taxId,
        String razonSocial,
        String nombreFantasia,
        String tipo,
        EstadoOrganizacion estado,
        OffsetDateTime creadoEn,
        DomicilioResponse domicilioPrincipal,
        List<DuenoResponse> duenos,
        List<RepresentanteVigenteResponse> representantesVigentes) {
}
