package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;

/** GET /organizaciones/{id}/identidad (consulta inter-modulo). */
public record IdentidadOrganizacionResponse(
        Long organizacionId, String cuit, String razonSocial, EstadoOrganizacion estado) {
}
