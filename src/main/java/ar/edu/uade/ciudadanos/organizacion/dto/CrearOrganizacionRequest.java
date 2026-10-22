package ar.edu.uade.ciudadanos.organizacion.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * POST /organizaciones (RF-02, RF-19).
 * El creador logueado se asume como el dueno inicial, con soporte para
 * titularidad personalizada, copropietarios (otrosDuenos) o lista explicita (duenos).
 */
public record CrearOrganizacionRequest(
        @NotBlank(message = "cuit es obligatorio")
        String cuit,

        @NotBlank(message = "razonSocial es obligatoria")
        @Size(max = 255, message = "razonSocial no puede superar los 255 caracteres")
        String razonSocial,

        @Size(max = 255, message = "nombreFantasia no puede superar los 255 caracteres")
        String nombreFantasia,

        String tipo,

        @Size(max = 255, message = "taxId no puede superar los 255 caracteres")
        String taxId,

        @DecimalMin(value = "0.01", message = "porcentajeCreador debe ser mayor que 0")
        @DecimalMax(value = "100.00", message = "porcentajeCreador no puede superar 100")
        BigDecimal porcentajeCreador,

        @Valid
        List<OtroDuenoRequest> otrosDuenos,

        @Valid
        List<DuenoInicialRequest> duenos) {
}
