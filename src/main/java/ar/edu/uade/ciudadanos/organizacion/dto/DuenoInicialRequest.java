package ar.edu.uade.ciudadanos.organizacion.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;

public record DuenoInicialRequest(
        @JsonAlias("ciudadanoId")
        Long personaId,

        @JsonAlias("personaId")
        Long ciudadanoId,

        @DecimalMin(value = "0.01", message = "porcentajeTitularidad debe ser mayor que 0")
        @DecimalMax(value = "100.00", message = "porcentajeTitularidad no puede superar 100")
        BigDecimal porcentajeTitularidad) {

    public Long id() {
        if (personaId != null) {
            return personaId;
        }
        return ciudadanoId;
    }
}
