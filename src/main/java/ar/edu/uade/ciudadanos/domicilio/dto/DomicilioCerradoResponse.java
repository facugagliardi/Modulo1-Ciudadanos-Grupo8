package ar.edu.uade.ciudadanos.domicilio.dto;

import java.time.LocalDate;

/**
 * 200 de DELETE /domicilios/{id}. No borra: cierra la vigencia (RF-11).
 * {@code nuevoPrincipalId} viene cuando el domicilio dado de baja era el
 * principal y otro lo reemplazo automaticamente.
 */
public record DomicilioCerradoResponse(Long propiedadId, LocalDate vigenteHasta, Long nuevoPrincipalId) {
}
