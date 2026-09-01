package ar.edu.uade.ciudadanos.expediente.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

/**
 * POST /expedientes/{id}/actuaciones (RF-33, RF-34).
 * Endpoint INFERIDO, igual que POST /expedientes.
 */
public record CrearActuacionRequest(
        /** Se valida contra lista blanca: INICIO, PASE, DICTAMEN, RESOLUCION, ... */
        @NotBlank(message = "tipo es obligatorio")
        String tipo,

        @NotBlank(message = "descripcion es obligatoria")
        String descripcion,

        @NotBlank(message = "moduloOrigen es obligatorio")
        String moduloOrigen,

        /** RF-34: referencias externas a archivos (URLs o ids de otro modulo). */
        List<String> adjuntos) {
}
