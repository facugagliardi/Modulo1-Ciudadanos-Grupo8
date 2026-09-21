package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Organizacion;
import java.math.BigDecimal;

/**
 * Item de GET /personas/{id}/organizaciones: donde la persona es duena.
 *
 * Ser dueno y ser representante son cosas distintas, y hasta ahora solo se
 * podia consultar la segunda. Eso dejaba a quien crea una organizacion sin
 * ninguna forma de encontrarla: el alta lo anota como dueno, no como
 * representante.
 *
 * Lleva el porcentaje porque es el dato que distingue a un dueno de otro y ya
 * esta en la fila del vinculo: no cuesta nada traerlo y evita un pedido mas.
 */
public record OrganizacionDeDuenoResponse(
        Long organizacionId,
        String cuit,
        String razonSocial,
        String nombreFantasia,
        String tipo,
        EstadoOrganizacion estado,
        BigDecimal porcentajeTitularidad) {

    public static OrganizacionDeDuenoResponse de(Organizacion o, BigDecimal porcentajeTitularidad) {
        return new OrganizacionDeDuenoResponse(o.getOrganizacionId(), String.valueOf(o.getCuit()),
                o.getRazonSocial(), o.getNombre(), o.getTipo(), o.getEstado(), porcentajeTitularidad);
    }
}
