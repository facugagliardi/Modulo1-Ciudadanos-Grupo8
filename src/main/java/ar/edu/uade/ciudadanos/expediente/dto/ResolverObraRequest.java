package ar.edu.uade.ciudadanos.expediente.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Dictamen administrativo real. El cliente no elige proyecto, actor ni correlacion. */
public record ResolverObraRequest(
        @NotBlank @Pattern(regexp = "approved|rejected", message = "resultado debe ser approved o rejected")
        String resultado,
        @NotBlank @Size(max = 4000) String resumen) {
}
