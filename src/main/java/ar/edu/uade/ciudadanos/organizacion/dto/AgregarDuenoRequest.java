package ar.edu.uade.ciudadanos.organizacion.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

/** POST /organizaciones/{id}/duenos (RF-19). */
public record AgregarDuenoRequest(
        @JsonAlias({"ciudadanoId"})
        @NotNull(message = "personaId es obligatorio")
        Long personaId,

        @DecimalMin(value = "0.01", message = "porcentajeTitularidad debe ser mayor que 0")
        @DecimalMax(value = "100.00", message = "porcentajeTitularidad no puede superar 100")
        BigDecimal porcentajeTitularidad,
        
        @jakarta.validation.Valid
        List<AjusteDuenoRequest> ajustes) {

    public AgregarDuenoRequest(Long personaId, BigDecimal porcentajeTitularidad) {
        this(personaId, porcentajeTitularidad, null);
    }
}

