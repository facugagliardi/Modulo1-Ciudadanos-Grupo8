package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;

/** GET /organizaciones/cuit/{cuit} (RF-06). Nunca 404. */
public record ExistenciaOrganizacionResponse(
        boolean existe, Long organizacionId, String razonSocial, EstadoOrganizacion estado) {

    public static ExistenciaOrganizacionResponse noExiste() {
        return new ExistenciaOrganizacionResponse(false, null, null, null);
    }
}
