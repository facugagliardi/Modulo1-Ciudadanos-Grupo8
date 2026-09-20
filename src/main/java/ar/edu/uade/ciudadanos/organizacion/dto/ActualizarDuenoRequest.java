package ar.edu.uade.ciudadanos.organizacion.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/** PUT /organizaciones/{id}/duenos/{personaId}. */
public record ActualizarDuenoRequest(
        @NotNull(message = "porcentajeTitularidad es obligatorio")
        @DecimalMin(value = "0.01", message = "porcentajeTitularidad debe ser mayor que 0")
        @DecimalMax(value = "100.00", message = "porcentajeTitularidad no puede superar 100")
        BigDecimal porcentajeTitularidad) {
}
