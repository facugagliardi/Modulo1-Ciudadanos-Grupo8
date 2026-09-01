package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import jakarta.validation.constraints.NotNull;

/** PATCH /organizaciones/{id}/estado (RF-08). */
public record CambioEstadoOrganizacionRequest(
        @NotNull(message = "estado es obligatorio (ACTIVA, INACTIVA o BLOQUEADA)")
        EstadoOrganizacion estado) {
}
