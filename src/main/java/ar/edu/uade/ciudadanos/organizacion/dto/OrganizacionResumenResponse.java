package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Organizacion;
import java.time.OffsetDateTime;

/** Item de GET /organizaciones. */
public record OrganizacionResumenResponse(
        Long organizacionId,
        String cuit,
        String taxId,
        String razonSocial,
        String nombreFantasia,
        String tipo,
        EstadoOrganizacion estado,
        OffsetDateTime creadoEn) {

    public static OrganizacionResumenResponse de(Organizacion o) {
        return new OrganizacionResumenResponse(o.getOrganizacionId(), String.valueOf(o.getCuit()), o.getTaxId(),
                o.getRazonSocial(), o.getNombre(), o.getTipo(), o.getEstado(), o.getCreadoEn());
    }
}
