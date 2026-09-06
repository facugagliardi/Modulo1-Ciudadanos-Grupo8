package ar.edu.uade.ciudadanos.organizacion.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record AjusteDuenoRequest(
        @NotNull(message = "personaId es obligatorio para el ajuste")
        Long personaId,

        @NotNull(message = "nuevoPorcentaje es obligatorio")
        @DecimalMin(value = "0.00", message = "nuevoPorcentaje no puede ser negativo")
        @DecimalMax(value = "100.00", message = "nuevoPorcentaje no puede superar 100")
        BigDecimal nuevoPorcentaje) {
}
